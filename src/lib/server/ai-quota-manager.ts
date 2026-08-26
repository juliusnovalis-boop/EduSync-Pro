/**
 * EDUSYNC AI QUOTA MANAGER — Quotas IA persistants (PostgreSQL).
 *
 * Remplace le quota mémoire (Map) du Gateway par un système persistant,
 * atomique, multi-tenant et DEMO/OFFICIEL safe.
 *
 * Tables :
 *   ai_usage_counters  → compteurs atomiques par période (minute / jour)
 *   ai_usage_logs      → historique détaillé des appels (additif)
 *
 * Clé logique unique d'un compteur :
 *   environment + school_id + user_id + role + period_type + period_key
 *
 * Atomicité :
 *   - Chaque compteur : INSERT ... ON CONFLICT DO UPDATE SET count = count + 1
 *     (via Drizzle onConflictDoUpdate) — jamais SELECT puis UPDATE séparés.
 *   - Minute + jour : enveloppés dans UNE transaction PostgreSQL. Si le quota
 *     journalier est dépassé, la transaction est annulée (rollback) → le
 *     compteur minute n'est PAS consommé par un refus.
 *
 * SUPER_ADMIN / school_id NULL :
 *   - Un index UNIQUE PostgreSQL traite les NULL comme distincts → plusieurs
 *     lignes school_id = NULL seraient autorisées pour la même clé logique.
 *   - Solution : sentinel "" (chaîne vide) à la place de NULL dans la clé
 *     unique. La colonne school_id stocke "" pour SUPER_ADMIN (jamais NULL).
 *
 * Les valeurs de ROLE_QUOTAS restent la référence des seuils (inchangées).
 */
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsageCounters, aiUsageLogs } from "@/db/schema";

/** Contexte de quota — toutes les dimensions proviennent du contexte serveur (jamais du client). */
export interface QuotaContext {
  userId: string;
  role: string;
  schoolId: string | null;
  environment: "demo" | "production";
  provider?: string;
  model?: string;
  taskType?: string;
  capability?: string;
}

export type PeriodType = "minute" | "day";

/** Limites par rôle — source de vérité (inchangée). */
export const ROLE_QUOTAS: Record<string, { perMinute: number; perDay: number }> = {
  SUPER_ADMIN: { perMinute: 60, perDay: 2000 },
  ADMIN: { perMinute: 40, perDay: 1000 },
  TEACHER: { perMinute: 20, perDay: 500 },
  STUDENT: { perMinute: 10, perDay: 200 },
  PARENT: { perMinute: 10, perDay: 200 },
};

/** Erreur de quota — conservée pour compatibilité avec AiGatewayError("QUOTA_EXCEEDED"). */
export class AiQuotaExceededError extends Error {
  constructor(message = "Quota IA gratuit atteint pour cette periode.") {
    super(message);
    this.name = "AiQuotaExceededError";
  }
}

/** Sentinel pour school_id NULL (SUPER_ADMIN) — évite le piège des NULL distincts dans l'index UNIQUE. */
const SCHOOL_SENTINEL = "";

/** Normalise schoolId : null → sentinel "" (jamais NULL dans la clé unique). */
function schoolKey(schoolId: string | null): string {
  return schoolId ?? SCHOOL_SENTINEL;
}

/** Normalise une minute en clé stable (YYYY-MM-DDTHH:MM). */
function minuteKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Normalise un jour en clé stable (YYYY-MM-DD). */
function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Génère un identifiant unique (même style que newId() dans data.ts). */
function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Limites du rôle (fallback TEACHER si rôle inconnu). */
export function getLimits(role: string): { perMinute: number; perDay: number } {
  return ROLE_QUOTAS[role.toUpperCase()] ?? ROLE_QUOTAS.TEACHER;
}

/**
 * Incrémente atomiquement les compteurs minute ET jour dans UNE transaction.
 * Retourne true si l'appel est autorisé, false si quota dépassé.
 * Aucun provider ne doit être appelé si false.
 *
 * Garanties :
 *   - Si le quota journalier est dépassé, une exception est levée DANS la
 *     transaction → rollback complet → le compteur minute n'est PAS consommé
 *     par un refus. (Drizzle committe si le callback retourne une valeur ;
 *     seul un throw déclenche le rollback.)
 *   - Deux requêtes concurrentes : l'ON CONFLICT + la transaction PostgreSQL
 *     garantissent qu'aucun dépassement ne se produit.
 */
export async function checkAndReserve(ctx: QuotaContext): Promise<boolean> {
  const now = new Date();
  const limits = getLimits(ctx.role);
  const mKey = minuteKey(now);
  const dKey = dayKey(now);
  const schoolId = schoolKey(ctx.schoolId);

  try {
    await db.transaction(async (tx) => {
      // Incrément atomique minute — throw → rollback si limite dépassée
      const minuteOk = await incrementCounter(tx, ctx, "minute", mKey, limits.perMinute, schoolId);
      if (!minuteOk) throw new AiQuotaExceededError();

      // Incrément atomique jour — throw → rollback (annule aussi l'incrément minute)
      const dayOk = await incrementCounter(tx, ctx, "day", dKey, limits.perDay, schoolId);
      if (!dayOk) throw new AiQuotaExceededError();
    });
    return true;
  } catch (err) {
    if (err instanceof AiQuotaExceededError) return false;
    throw err;
  }
}

/**
 * Incrémente atomiquement un compteur via INSERT ... ON CONFLICT DO UPDATE.
 * Retourne false si le compteur (après incrément) dépasse la limite.
 * Exécuté dans la transaction fournie par checkAndReserve.
 */
async function incrementCounter(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ctx: QuotaContext,
  periodType: PeriodType,
  periodKey: string,
  limit: number,
  schoolId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const id = newId();

  // INSERT ... ON CONFLICT DO UPDATE SET count = count + 1
  const rows = await tx
    .insert(aiUsageCounters)
    .values({
      id,
      environment: ctx.environment,
      school_id: schoolId,
      user_id: ctx.userId,
      role: ctx.role.toUpperCase(),
      period_type: periodType,
      period_key: periodKey,
      count: 1,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [
        aiUsageCounters.environment,
        aiUsageCounters.school_id,
        aiUsageCounters.user_id,
        aiUsageCounters.role,
        aiUsageCounters.period_type,
        aiUsageCounters.period_key,
      ],
      set: {
        count: sql`${aiUsageCounters.count} + 1`,
        updated_at: now,
      },
    })
    .returning({ count: aiUsageCounters.count });

  const newCount = rows[0]?.count ?? 1;
  return newCount <= limit;
}

/**
 * Enregistre un log d'usage détaillé (après exécution provider).
 * Les tokens sont NULL si indisponibles — jamais inventés.
 */
export async function recordUsage(
  ctx: QuotaContext,
  opts: {
    status: "success" | "error" | "quota_exceeded";
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  },
): Promise<void> {
  try {
    await db.insert(aiUsageLogs).values({
      id: newId(),
      environment: ctx.environment,
      school_id: schoolKey(ctx.schoolId),
      user_id: ctx.userId,
      role: ctx.role.toUpperCase(),
      provider: ctx.provider ?? null,
      model: ctx.model ?? null,
      task_type: ctx.taskType ?? null,
      capability: ctx.capability ?? null,
      input_tokens: opts.inputTokens ?? null,
      output_tokens: opts.outputTokens ?? null,
      total_tokens: opts.totalTokens ?? null,
      status: opts.status,
      created_at: new Date().toISOString(),
    });
  } catch {
    /* non bloquant — ne doit jamais casser la demande */
  }
}

/** Lit l'usage courant (minute + jour) pour un contexte donné. */
export async function getUsage(ctx: QuotaContext): Promise<{ minute: number; day: number }> {
  const now = new Date();
  const mKey = minuteKey(now);
  const dKey = dayKey(now);
  const schoolId = schoolKey(ctx.schoolId);

  const [minuteRows, dayRows] = await Promise.all([
    db
      .select({ count: aiUsageCounters.count })
      .from(aiUsageCounters)
      .where(
        and(
          eq(aiUsageCounters.environment, ctx.environment),
          eq(aiUsageCounters.school_id, schoolId),
          eq(aiUsageCounters.user_id, ctx.userId),
          eq(aiUsageCounters.role, ctx.role.toUpperCase()),
          eq(aiUsageCounters.period_type, "minute"),
          eq(aiUsageCounters.period_key, mKey),
        ),
      )
      .limit(1),
    db
      .select({ count: aiUsageCounters.count })
      .from(aiUsageCounters)
      .where(
        and(
          eq(aiUsageCounters.environment, ctx.environment),
          eq(aiUsageCounters.school_id, schoolId),
          eq(aiUsageCounters.user_id, ctx.userId),
          eq(aiUsageCounters.role, ctx.role.toUpperCase()),
          eq(aiUsageCounters.period_type, "day"),
          eq(aiUsageCounters.period_key, dKey),
        ),
      )
      .limit(1),
  ]);

  return {
    minute: minuteRows[0]?.count ?? 0,
    day: dayRows[0]?.count ?? 0,
  };
}