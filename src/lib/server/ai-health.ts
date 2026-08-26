/**
 * EDUSYNC PRO — AI Health Center (lecture seule, léger).
 * Agrège l'état réel des composants EXISTANTS : DB, FREE_POLICY, AIQuotaManager,
 * providers (aucun appel réseau facturé), routes IA déclaratives, métriques 24h.
 */
import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { aiUsageCounters, aiUsageLogs } from "@/db/schema";
import { PROVIDER_PRIORITY, listProviders, checkModelIsFree, type AiProviderId } from "./ai-policy";
import { ROLE_QUOTAS, getUsage } from "./ai-quota-manager";

/** Modèle sonde gratuit canonique par provider (vérification de politique uniquement). */
const FREE_PROBE_MODEL: Record<AiProviderId, string | null> = {
  gemini: "gemini-2.5-flash-lite",
  openrouter: "openrouter/free",
  huggingface: null,
  ollama: null,
};

export type AiHealthReport = {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  checkedAt: string;
  environment: "demo" | "production";
  database: { connected: boolean; countersAccessible: boolean; logsAccessible: boolean };
  policy: { loaded: boolean; priority: string[]; freeOnlyEnforced: boolean };
  quota: { managerOperational: boolean; rolesConfigured: string[]; minuteUsed: number; dayUsed: number };
  providers: Array<{ id: string; label: string; configured: boolean; enabled: boolean; freePolicyAllowed: boolean; status: string; reason?: string }>;
  routes: Array<{ path: string; guard: boolean; gateway: boolean; router: boolean; policy: boolean }>;
  usage24h: { requests: number; success: number; errors: number; quotaExceeded: number; byProvider: Record<string, number>; byModel: Record<string, number> };
};

function minuteKeyNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function dayKeyNow(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getAiHealth(environment: "demo" | "production"): Promise<AiHealthReport> {
  const report: AiHealthReport = {
    status: "UNHEALTHY",
    checkedAt: new Date().toISOString(),
    environment,
    database: { connected: false, countersAccessible: false, logsAccessible: false },
    policy: { loaded: false, priority: [...PROVIDER_PRIORITY], freeOnlyEnforced: false },
    quota: { managerOperational: false, rolesConfigured: Object.keys(ROLE_QUOTAS), minuteUsed: 0, dayUsed: 0 },
    providers: [],
    routes: [
      { path: "/api/ai", guard: true, gateway: true, router: true, policy: true },
      { path: "/api/ai/chat", guard: true, gateway: true, router: true, policy: true },
      { path: "/api/ai/gateway", guard: true, gateway: true, router: true, policy: true },
      { path: "/api/ocr", guard: true, gateway: true, router: true, policy: true },
      { path: "/api/transcribe", guard: true, gateway: true, router: true, policy: true },
      { path: "/api/ai/usage", guard: true, gateway: false, router: false, policy: false },
      { path: "/api/ai/audit", guard: true, gateway: false, router: false, policy: false },
    ],
    usage24h: { requests: 0, success: 0, errors: 0, quotaExceeded: 0, byProvider: {}, byModel: {} },
  };

  // 1) DATABASE
  try {
    await db.execute(sql`SELECT 1`);
    report.database.connected = true;
    await db.select({ n: sql<number>`count(*)::int` }).from(aiUsageCounters).limit(1);
    report.database.countersAccessible = true;
    await db.select({ n: sql<number>`count(*)::int` }).from(aiUsageLogs).limit(1);
    report.database.logsAccessible = true;
  } catch {
    /* UNHEALTHY */
  }

  // 2) POLICY — chargée + FREE ONLY effectif (sonde statique, aucun appel réseau)
  try {
    const geminiFree = checkModelIsFree("gemini", FREE_PROBE_MODEL.gemini as string);
    const orFree = checkModelIsFree("openrouter", FREE_PROBE_MODEL.openrouter as string);
    const hfBlocked = !checkModelIsFree("huggingface", "any-model").allowed;
    report.policy.loaded = PROVIDER_PRIORITY.length > 0 && geminiFree.allowed && orFree.allowed;
    report.policy.freeOnlyEnforced = hfBlocked;
  } catch {
    report.policy.loaded = false;
  }

  // 3) QUOTA — manager opérationnel (lecture compteurs du contexte courant)
  try {
    const usage = await getUsage({ userId: "__health__", role: "SUPER_ADMIN", schoolId: null, environment });
    report.quota.minuteUsed = usage.minute;
    report.quota.dayUsed = usage.day;
    const minuteRows = await db
      .select({ n: sql<number>`coalesce(sum(count),0)::int` })
      .from(aiUsageCounters)
      .where(and(eq(aiUsageCounters.period_type, "minute"), eq(aiUsageCounters.period_key, minuteKeyNow()), eq(aiUsageCounters.environment, environment)));
    report.quota.minuteUsed = minuteRows[0]?.n ?? report.quota.minuteUsed;
    const dayRows = await db
      .select({ n: sql<number>`coalesce(sum(count),0)::int` })
      .from(aiUsageCounters)
      .where(and(eq(aiUsageCounters.period_type, "day"), eq(aiUsageCounters.period_key, dayKeyNow()), eq(aiUsageCounters.environment, environment)));
    report.quota.dayUsed = dayRows[0]?.n ?? report.quota.dayUsed;
    report.quota.managerOperational = report.database.countersAccessible && Object.keys(ROLE_QUOTAS).length > 0;
  } catch {
    report.quota.managerOperational = false;
  }

  // 4) PROVIDERS — état statique uniquement (aucun appel réel, aucune facturation)
  const infos = listProviders();
  for (const id of PROVIDER_PRIORITY) {
    const info = infos.find((p) => p.id === id);
    const probe = FREE_PROBE_MODEL[id];
    const freeAllowed = probe !== null ? checkModelIsFree(id, probe).allowed : false;
    let status = "not_configured";
    let reason: string | undefined;
    if (!info?.configured) {
      status = "not_configured";
      reason = "NO_API_KEY";
    } else if (!freeAllowed) {
      status = "blocked";
      reason = "FREE_POLICY_BLOCKED";
    } else {
      status = "ready";
    }
    report.providers.push({
      id,
      label: info?.label ?? id,
      configured: info?.configured ?? false,
      enabled: freeAllowed,
      freePolicyAllowed: freeAllowed,
      status,
      reason,
    });
  }

  // 5) MÉTRIQUES 24h (fenêtre serveur, environnement demandé)
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const conditions: SQL[] = [gte(aiUsageLogs.created_at, since), eq(aiUsageLogs.environment, environment)];
    const where = and(...conditions);
    const countExpr = sql<number>`count(*)::int`;
    const [statusRows, providerRows, modelRows] = await Promise.all([
      db.select({ status: aiUsageLogs.status, n: countExpr }).from(aiUsageLogs).where(where).groupBy(aiUsageLogs.status),
      db.select({ provider: aiUsageLogs.provider, n: countExpr }).from(aiUsageLogs).where(where).groupBy(aiUsageLogs.provider),
      db.select({ model: aiUsageLogs.model, n: countExpr }).from(aiUsageLogs).where(where).groupBy(aiUsageLogs.model),
    ]);
    const byStatus = (name: string | null) => statusRows.find((r) => r.status === name)?.n ?? 0;
    report.usage24h = {
      requests: statusRows.reduce((s, r) => s + r.n, 0),
      success: byStatus("success"),
      errors: byStatus("error"),
      quotaExceeded: byStatus("quota_exceeded"),
      byProvider: Object.fromEntries(providerRows.map((r) => [r.provider ?? "unknown", r.n])),
      byModel: Object.fromEntries(modelRows.map((r) => [r.model ?? "unknown", r.n])),
    };
  } catch {
    /* métriques indisponibles — déjà reflété par database checks */
  }

  // 6) STATUT GLOBAL
  const coreOk = report.database.connected && report.database.countersAccessible && report.database.logsAccessible;
  const policyOk = report.policy.loaded && report.policy.freeOnlyEnforced;
  const quotaOk = report.quota.managerOperational;
  const anyRemoteReady = report.providers.some((p) => p.id !== "huggingface" && p.configured && p.enabled && p.freePolicyAllowed);
  report.status = !coreOk || !quotaOk || !policyOk ? "UNHEALTHY" : anyRemoteReady ? "HEALTHY" : "DEGRADED";

  return report;
}
