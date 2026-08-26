import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { aiAccessLogs, aiUsageLogs } from "@/db/schema";
import { aiGuard } from "@/lib/server/ai-guard";
import { PERMISSIONS, canAccessSchool } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/audit — consultation READ-ONLY des journaux IA.
 *
 *   GET → aiGuard (permission AUDIT_READ existante) → validation filtres → DB → réponse
 *
 * Sources (paramètre `source`) :
 *   - "access" (défaut) : ai_access_logs — écrit par aiGuard().
 *     ⚠ Cette table ne porte NI school_id NI environment : aucune isolation
 *     établissement n'est possible → réservée à SUPER_ADMIN (canAccessSchool),
 *     afin d'exclure toute fuite inter-établissements pour les ADMIN.
 *   - "usage" : ai_usage_logs — écrit par AIQuotaManager.recordUsage().
 *     Possède environment/school_id → ADMIN isolé sur son établissement.
 *
 * Aucune donnée sensible (clés, tokens, prompts/réponses complets) n'est exposée ;
 * seuls les champs d'audit présents au schéma sont retournés — rien n'est inventé.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const VALID_SOURCES: ReadonlySet<string> = new Set(["access", "usage"]);
const VALID_ROLES: ReadonlySet<string> = new Set(["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT", "PARENT"]);
const VALID_STATUSES: ReadonlySet<string> = new Set(["success", "error", "quota_exceeded"]);
const VALID_PROVIDERS: ReadonlySet<string> = new Set(["gemini", "openrouter", "huggingface", "local"]);

/** Filtres applicables par source (toute clé inconnue est refusée — pas de requête libre). */
const ALLOWED_PARAMS: Record<string, ReadonlySet<string>> = {
  access: new Set(["limit", "source", "role", "resource", "granted", "dateFrom", "dateTo"]),
  usage: new Set(["limit", "source", "role", "status", "provider", "dateFrom", "dateTo"]),
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valide une borne de date ISO courte ; renvoie null si invalide. */
function parseDate(value: string | null): string | null {
  if (value === null) return null;
  if (!DATE_RE.test(value)) return null;
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? null : value;
}

/** Jour suivant (pour une borne haute exclusive sur created_at ISO). */
function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // 1) Auth + permission administrative EXISTANTE (jamais de base avant autorisation).
  const guard = await aiGuard(req, PERMISSIONS.AUDIT_READ, "ai-audit", "read");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const url = new URL(req.url);

    // 2) Filtres : uniquement des paramètres simples et bornés.
    const source = url.searchParams.get("source") ?? "access";
    if (!VALID_SOURCES.has(source)) {
      return NextResponse.json({ error: "source doit être \"access\" ou \"usage\"." }, { status: 400 });
    }

    for (const key of url.searchParams.keys()) {
      if (!ALLOWED_PARAMS[source].has(key)) {
        return NextResponse.json({ error: `Paramètre non supporté pour cette source : ${key}` }, { status: 400 });
      }
    }

    const limitRaw = url.searchParams.get("limit") ?? String(DEFAULT_LIMIT);
    if (!/^\d+$/.test(limitRaw)) {
      return NextResponse.json({ error: "limit doit être un entier positif." }, { status: 400 });
    }
    const limit = Number(limitRaw);
    if (limit < 1 || limit > MAX_LIMIT) {
      return NextResponse.json({ error: `limit doit être compris entre 1 et ${MAX_LIMIT}.` }, { status: 400 });
    }

    let roleFilter = url.searchParams.get("role");
    if (roleFilter !== null) {
      roleFilter = roleFilter.trim().toUpperCase();
      if (!VALID_ROLES.has(roleFilter)) {
        return NextResponse.json({ error: "role invalide." }, { status: 400 });
      }
    }

    let dateFrom = parseDate(url.searchParams.get("dateFrom"));
    let dateTo = parseDate(url.searchParams.get("dateTo"));
    if (url.searchParams.get("dateFrom") !== null && dateFrom === null) {
      return NextResponse.json({ error: "dateFrom invalide (YYYY-MM-DD attendu)." }, { status: 400 });
    }
    if (url.searchParams.get("dateTo") !== null && dateTo === null) {
      return NextResponse.json({ error: "dateTo invalide (YYYY-MM-DD attendu)." }, { status: 400 });
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return NextResponse.json({ error: "dateFrom doit précéder dateTo." }, { status: 400 });
    }
    const isSuperAdmin = canAccessSchool(guard.ctx.role, guard.ctx.schoolId, null);

    if (source === "usage") {
      // 3) Multi-tenant : ADMIN isolé sur son établissement (school_id serveur).
      if (!isSuperAdmin && !guard.ctx.schoolId) {
        return NextResponse.json({ error: "Aucun établissement rattaché à ce compte." }, { status: 403 });
      }

      let statusFilter = url.searchParams.get("status");
      if (statusFilter !== null && !VALID_STATUSES.has(statusFilter)) {
        return NextResponse.json({ error: "status invalide." }, { status: 400 });
      }
      let providerFilter = url.searchParams.get("provider");
      if (providerFilter !== null && !VALID_PROVIDERS.has(providerFilter)) {
        return NextResponse.json({ error: "provider invalide." }, { status: 400 });
      }

      const conditions: SQL[] = [];
      if (!isSuperAdmin) conditions.push(eq(aiUsageLogs.school_id, guard.ctx.schoolId as string));
      if (roleFilter) conditions.push(eq(aiUsageLogs.role, roleFilter));
      if (statusFilter) conditions.push(eq(aiUsageLogs.status, statusFilter));
      if (providerFilter) conditions.push(eq(aiUsageLogs.provider, providerFilter));
      if (dateFrom) conditions.push(gte(aiUsageLogs.created_at, dateFrom));
      if (dateTo) conditions.push(lt(aiUsageLogs.created_at, nextDay(dateTo)));

      const rows = await db
        .select({
          id: aiUsageLogs.id,
          environment: aiUsageLogs.environment,
          schoolId: aiUsageLogs.school_id,
          userId: aiUsageLogs.user_id,
          role: aiUsageLogs.role,
          provider: aiUsageLogs.provider,
          model: aiUsageLogs.model,
          status: aiUsageLogs.status,
          createdAt: aiUsageLogs.created_at,
        })
        .from(aiUsageLogs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(aiUsageLogs.created_at))
        .limit(limit);

      return NextResponse.json(rows);
    }

    // source === "access" : ai_access_logs sans school_id → SUPER_ADMIN uniquement.
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Journal d'accès IA global : consultation réservée au Super Admin." },
        { status: 403 },
      );
    }

    let resourceFilter = url.searchParams.get("resource");
    if (resourceFilter !== null && resourceFilter.length > 60) {
      return NextResponse.json({ error: "resource invalide." }, { status: 400 });
    }

    let grantedFilter = url.searchParams.get("granted");
    if (grantedFilter !== null && grantedFilter !== "true" && grantedFilter !== "false") {
      return NextResponse.json({ error: "granted doit être true ou false." }, { status: 400 });
    }

    const conditions: SQL[] = [];
    if (roleFilter) conditions.push(eq(aiAccessLogs.role, roleFilter));
    if (resourceFilter) conditions.push(eq(aiAccessLogs.resource, resourceFilter));
    if (grantedFilter) conditions.push(eq(aiAccessLogs.granted, grantedFilter === "true"));
    if (dateFrom) conditions.push(gte(aiAccessLogs.created_at, dateFrom));
    if (dateTo) conditions.push(lt(aiAccessLogs.created_at, nextDay(dateTo)));

    const rows = await db
      .select({
        id: aiAccessLogs.id,
        userId: aiAccessLogs.user_id,
        role: aiAccessLogs.role,
        resource: aiAccessLogs.resource,
        action: aiAccessLogs.action,
        permission: aiAccessLogs.permission,
        granted: aiAccessLogs.granted,
        createdAt: aiAccessLogs.created_at,
      })
      .from(aiAccessLogs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(aiAccessLogs.created_at))
      .limit(limit);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[api/ai/audit]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
