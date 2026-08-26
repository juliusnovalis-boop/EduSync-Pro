import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { aiUsageLogs, establishments } from "@/db/schema";
import { aiGuard } from "@/lib/server/ai-guard";
import { bindEnvironment } from "@/lib/server/environment";
import { PERMISSIONS } from "@/lib/server/rbac";
import { getLimits, getUsage } from "@/lib/server/ai-quota-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/usage — tableau de bord READ-ONLY de consommation IA.
 *
 *   GET → aiGuard (AUDIT_READ existante) → validation fenêtre/filtres → AIQuotaManager + DB → réponse
 *
 * RBAC : ADMIN & SUPER_ADMIN (permission existante). TEACHER/STUDENT/PARENT refusés par aiGuard.
 * Multi-tenant : ADMIN verrouillé côté serveur sur son school_id (aucun paramètre client accepté).
 * SUPER_ADMIN peut filtrer par établissement EXISTANT (validé en base) et distinguer demo/production —
 * ces paramètres sont de simples filtres de consultation : l'identité/contexte reste serveur (aiGuard).
 * Aucun prompt, aucune réponse IA, aucun secret n'est exposé.
 */

const VALID_PERIODS: ReadonlySet<string> = new Set(["today", "7d", "30d"]);
const VALID_ENVIRONMENTS: ReadonlySet<string> = new Set(["demo", "production"]);

/** Date ISO courte du début de la fenêtre (inclusive). */
function windowStart(period: string): string {
  const d = new Date();
  const offset = period === "today" ? 0 : period === "7d" ? 6 : 29;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function quotaPart(used: number, limit: number) {
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export async function GET(req: NextRequest) {
  // 1) Auth + permission administrative existante.
  const guard = await aiGuard(req, PERMISSIONS.AUDIT_READ, "ai-usage", "read");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    // 2) Contexte serveur : le schéma DB suit l'environnement du jeton (DEMO ≠ OFFICIAL).
    bindEnvironment(guard.environment);

    const url = new URL(req.url);
    const isSuperAdmin = guard.ctx.role === "SUPER_ADMIN";

    const period = url.searchParams.get("period") ?? "today";
    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "period doit être today, 7d ou 30d." }, { status: 400 });
    }

    // Filtres administratifs : réservés au SUPER_ADMIN, validés côté serveur.
    const schoolParam = url.searchParams.get("schoolId");
    const envParam = url.searchParams.get("environment");
    if (!isSuperAdmin && (schoolParam !== null || envParam !== null)) {
      return NextResponse.json({ error: "Filtres administratifs réservés au Super Admin." }, { status: 400 });
    }

    let schoolFilter: string | null = null;
    if (schoolParam !== null) {
      const exists = await db
        .select({ id: establishments.id })
        .from(establishments)
        .where(eq(establishments.id, schoolParam))
        .limit(1);
      if (!exists.length) {
        return NextResponse.json({ error: "Établissement introuvable." }, { status: 400 });
      }
      schoolFilter = schoolParam;
    }
    let envFilter: string | null = null;
    if (envParam !== null) {
      if (!VALID_ENVIRONMENTS.has(envParam)) {
        return NextResponse.json({ error: "environment doit être demo ou production." }, { status: 400 });
      }
      envFilter = envParam;
    }

    // 3) Résumé quota du compte appelant (contexte serveur — AIQuotaManager).
    const usage = await getUsage({
      userId: guard.ctx.userId,
      role: guard.ctx.role,
      schoolId: guard.ctx.schoolId,
      environment: guard.environment,
    });
    const limits = getLimits(guard.ctx.role);

    // 4) Agrégations sur la fenêtre (ai_usage_logs uniquement — pas d'access logs).
    const since = windowStart(period);
    const conditions: SQL[] = [gte(aiUsageLogs.created_at, since)];
    // Multi-tenant : ADMIN verrouillé sur son établissement (jamais via le client).
    if (!isSuperAdmin) {
      conditions.push(eq(aiUsageLogs.school_id, guard.ctx.schoolId as string));
    } else if (schoolFilter) {
      conditions.push(eq(aiUsageLogs.school_id, schoolFilter));
    }
    if (envFilter) conditions.push(eq(aiUsageLogs.environment, envFilter));
    const where = and(...conditions);

    const countExpr = sql<number>`count(*)::int`;
    const [statusRows, providerRows, modelRows, roleRows, envRows] = await Promise.all([
      db.select({ status: aiUsageLogs.status, n: countExpr }).from(aiUsageLogs).where(where).groupBy(aiUsageLogs.status),
      db.select({ provider: aiUsageLogs.provider, n: countExpr }).from(aiUsageLogs).where(where).groupBy(aiUsageLogs.provider),
      db.select({ model: aiUsageLogs.model, n: countExpr }).from(aiUsageLogs).where(where).groupBy(aiUsageLogs.model),
      db.select({ role: aiUsageLogs.role, n: countExpr }).from(aiUsageLogs).where(where).groupBy(aiUsageLogs.role),
      db.select({ environment: aiUsageLogs.environment, n: countExpr }).from(aiUsageLogs).where(where).groupBy(aiUsageLogs.environment),
    ]);

    const byStatus = (name: string | null) => statusRows.find((r) => r.status === name)?.n ?? 0;
    const totals = {
      requests: statusRows.reduce((s, r) => s + r.n, 0),
      success: byStatus("success"),
      errors: byStatus("error"),
      quotaExceeded: byStatus("quota_exceeded"),
    };

    return NextResponse.json({
      window: { period, since },
      scope: isSuperAdmin ? { schoolId: schoolFilter ?? "all", environment: envFilter ?? "all" } : { schoolId: guard.ctx.schoolId, environment: guard.environment },
      summary: {
        minute: quotaPart(usage.minute, limits.perMinute),
        day: quotaPart(usage.day, limits.perDay),
      },
      totals,
      byProvider: Object.fromEntries(providerRows.map((r) => [r.provider ?? "unknown", r.n])),
      byModel: Object.fromEntries(modelRows.map((r) => [r.model ?? "unknown", r.n])),
      byRole: Object.fromEntries(roleRows.map((r) => [r.role ?? "unknown", r.n])),
      byEnvironment: Object.fromEntries(envRows.map((r) => [r.environment ?? "unknown", r.n])),
    });
  } catch (error) {
    console.error("[api/ai/usage]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
