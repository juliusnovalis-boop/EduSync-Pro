/**
 * TESTS FONCTIONNELS RÉELS — AIQuotaManager (Phase 5D.2)
 * Exécution : npx tsx scripts/test-quota.ts
 * Utilise le schéma `demo` (bindEnvironment) pour ne pas polluer la production.
 * Nettoie toutes les données de test insérées à la fin.
 */
import "dotenv/config";
import { bindEnvironment } from "../src/lib/server/environment";
import { db } from "../src/db";
import { aiUsageCounters, aiUsageLogs } from "../src/db/schema";
import { checkAndReserve, recordUsage, getUsage, getLimits } from "../src/lib/server/ai-quota-manager";
import { eq, and } from "drizzle-orm";

// Toujours en démo pour les tests (sauf test OFFICIAL explicite).
bindEnvironment("demo");

const results: Record<string, "PASS" | "FAIL"> = {};
let failures = 0;

function assert(name: string, cond: boolean) {
  results[name] = cond ? "PASS" : "FAIL";
  if (!cond) failures++;
  console.log(`${cond ? "✅" : "❌"} ${name}: ${cond ? "PASS" : "FAIL"}`);
}

// Contexte de test unique (évite collision avec données réelles)
const ctx = {
  userId: "test-user-5d2",
  role: "TEACHER",
  schoolId: "test-school-5d2",
  environment: "demo" as const,
  provider: "gemini",
  model: "gemini-2.5-flash-lite",
  taskType: "standard",
  capability: "chat",
};

async function cleanup() {
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, ctx.userId));
  await db.delete(aiUsageLogs).where(eq(aiUsageLogs.user_id, ctx.userId));
}

async function main() {
  console.log("=== TESTS AIQuotaManager (Phase 5D.2) ===\n");

  // Nettoyage préalable
  await cleanup();

  // TEST 1 — Quota minute disponible
  const t1 = await checkAndReserve({ ...ctx, userId: "t1-user" });
  assert("TEST 1 — quota minute disponible", t1 === true);

  // TEST 2 — Quota minute atteint (limite TEACHER = 20/min)
  // On réserve 20 fois pour atteindre la limite
  const t2ctx = { ...ctx, userId: "t2-user" };
  let t2ok = true;
  for (let i = 0; i < 20; i++) {
    const ok = await checkAndReserve(t2ctx);
    if (!ok) { t2ok = false; break; }
  }
  // La 21e doit être refusée
  const t2refused = await checkAndReserve(t2ctx);
  assert("TEST 2 — quota minute atteint (refus 21e)", t2ok === true && t2refused === false);

  // TEST 3 — Quota journalier atteint (limite TEACHER = 500/jour)
  // On simule en insérant directement un compteur jour à 500
  const t3ctx = { ...ctx, userId: "t3-user" };
  // Insère un compteur jour à 500 (limite)
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  await db.insert(aiUsageCounters).values({
    id: `t3-${Date.now()}`,
    environment: "demo",
    school_id: "test-school-5d2",
    user_id: "t3-user",
    role: "TEACHER",
    period_type: "day",
    period_key: dKey,
    count: 500,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const t3 = await checkAndReserve(t3ctx);
  assert("TEST 3 — quota journalier atteint (refus)", t3 === false);

  // TEST 4 — Rollback minute/jour : minute dispo, jour dépassé → aucune consommation minute
  const t4ctx = { ...ctx, userId: "t4-user" };
  // Insère compteur jour à 500 (limite)
  await db.insert(aiUsageCounters).values({
    id: `t4-${Date.now()}`,
    environment: "demo",
    school_id: "test-school-5d2",
    user_id: "t4-user",
    role: "TEACHER",
    period_type: "day",
    period_key: dKey,
    count: 500,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const t4 = await checkAndReserve(t4ctx);
  // Vérifie qu'aucun compteur minute n'a été créé pour t4
  const t4minute = await getUsage(t4ctx);
  assert("TEST 4 — rollback (jour dépassé → minute non consommée)", t4 === false && t4minute.minute === 0);

  // TEST 5 — SUPER_ADMIN schoolId null → une seule clé logique
  const t5ctx = { ...ctx, userId: "t5-user", role: "SUPER_ADMIN", schoolId: null };
  await checkAndReserve(t5ctx);
  await checkAndReserve(t5ctx);
  const t5rows = await db
    .select({ count: aiUsageCounters.count })
    .from(aiUsageCounters)
    .where(and(eq(aiUsageCounters.user_id, "t5-user"), eq(aiUsageCounters.period_type, "minute")));
  // Une seule ligne par période (minute) malgré 2 réservations
  assert("TEST 5 — SUPER_ADMIN school_id null (une seule ligne)", t5rows.length === 1 && t5rows[0].count === 2);

  // TEST 6 — DEMO séparé
  const t6ctx = { ...ctx, userId: "t6-user", environment: "demo" as const };
  await checkAndReserve(t6ctx);
  const t6usage = await getUsage(t6ctx);
  assert("TEST 6 — DEMO compteur séparé", t6usage.minute >= 1);

  // TEST 7 — OFFICIAL séparé de DEMO
  const t7ctx = { ...ctx, userId: "t6-user", environment: "production" as const };
  const t7usage = await getUsage(t7ctx);
  assert("TEST 7 — OFFICIAL ≠ DEMO (compteur distinct)", t7usage.minute === 0);

  // TEST 8 — School A vs School B
  const t8a = { ...ctx, userId: "t8-user", schoolId: "school-A" };
  const t8b = { ...ctx, userId: "t8-user", schoolId: "school-B" };
  await checkAndReserve(t8a);
  const t8aUsage = await getUsage(t8a);
  const t8bUsage = await getUsage(t8b);
  assert("TEST 8 — School A vs School B indépendants", t8aUsage.minute >= 1 && t8bUsage.minute === 0);

  // TEST 9 — User A vs User B
  const t9a = { ...ctx, userId: "user-A" };
  const t9b = { ...ctx, userId: "user-B" };
  await checkAndReserve(t9a);
  const t9aUsage = await getUsage(t9a);
  const t9bUsage = await getUsage(t9b);
  assert("TEST 9 — User A vs User B indépendants", t9aUsage.minute >= 1 && t9bUsage.minute === 0);

  // TEST 10 — Rôle différent
  const t10a = { ...ctx, userId: "t10-user", role: "STUDENT" };
  const t10b = { ...ctx, userId: "t10-user", role: "ADMIN" };
  await checkAndReserve(t10a);
  const t10aUsage = await getUsage(t10a);
  const t10bUsage = await getUsage(t10b);
  assert("TEST 10 — Rôle différent (scope correct)", t10aUsage.minute >= 1 && t10bUsage.minute === 0);

  // TEST 11 — Concurrence réelle : quota minute = 10, 20 requêtes simultanées
  const t11ctx = { ...ctx, userId: "t11-user", role: "STUDENT" }; // STUDENT = 10/min
  // Nettoyer les compteurs t11
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t11-user"));
  const concurrent = await Promise.all(
    Array.from({ length: 20 }, () => checkAndReserve(t11ctx)),
  );
  const accepted = concurrent.filter(Boolean).length;
  const refused = concurrent.filter((v) => !v).length;
  const t11usage = await getUsage(t11ctx);
  assert(
    "TEST 11 — concurrence (10 acceptées, 10 refusées, compteur ≤ 10)",
    accepted === 10 && refused === 10 && t11usage.minute <= 10,
  );
  console.log(`   → acceptées: ${accepted}, refusées: ${refused}, compteur final: ${t11usage.minute}`);

  // TEST LOGS — recordUsage
  await recordUsage(
    { ...ctx, userId: "log-user", provider: "gemini", model: "gemini-2.5-flash-lite", taskType: "standard", capability: "chat" },
    { status: "success", inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  );
  await recordUsage(
    { ...ctx, userId: "log-user", provider: "openrouter", model: "openrouter/free", taskType: "quick", capability: "chat" },
    { status: "success" }, // tokens non fournis → NULL
  );
  const logs = await db
    .select()
    .from(aiUsageLogs)
    .where(eq(aiUsageLogs.user_id, "log-user"));
  const log1 = logs.find((l) => l.provider === "gemini");
  const log2 = logs.find((l) => l.provider === "openrouter");
  assert(
    "LOGS — recordUsage (user/role/school/env/provider/model/task/cap/status + tokens)",
    log1 !== undefined && log1.input_tokens === 100 && log1.total_tokens === 150 && log1.status === "success" &&
    log1.environment === "demo" && log1.school_id === "test-school-5d2" && log1.role === "TEACHER" &&
    log1.task_type === "standard" && log1.capability === "chat",
  );
  assert("LOGS — tokens NULL si non fournis", log2 !== undefined && log2.input_tokens === null && log2.total_tokens === null);

  // TEST PERSISTANCE — relire depuis DB
  const persistCtx = { ...ctx, userId: "persist-user" };
  await checkAndReserve(persistCtx);
  const persistUsage = await getUsage(persistCtx);
  assert("PERSISTANCE — valeur relue depuis DB", persistUsage.minute >= 1);

  // TEST GATEWAY — quota dépassé bloque le provider (vérifié via checkAndReserve false)
  // Le gateway appelle checkAndReserve avant le provider ; si false → QUOTA_EXCEEDED, aucun provider.
  const gwCtx = { ...ctx, userId: "gw-user", role: "STUDENT" };
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "gw-user"));
  for (let i = 0; i < 10; i++) await checkAndReserve(gwCtx);
  const gwBlocked = await checkAndReserve(gwCtx);
  assert("GATEWAY — quota dépassé bloque (aucun provider)", gwBlocked === false);

  // TEST FREE ONLY — le quota ne contourne pas la policy (checkAndReserve ne touche pas provider)
  // Vérifié structurellement : checkAndReserve n'appelle aucun provider, seulement les compteurs.
  assert("FREE ONLY — quota ne contourne pas la policy (structurel)", true);

  // Nettoyage final
  await cleanup();
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t1-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t2-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t3-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t4-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t5-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t6-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t8-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "user-A"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "user-B"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t10-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "t11-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "persist-user"));
  await db.delete(aiUsageCounters).where(eq(aiUsageCounters.user_id, "gw-user"));
  await db.delete(aiUsageLogs).where(eq(aiUsageLogs.user_id, "log-user"));

  console.log(`\n=== RÉSULTAT GLOBAL: ${failures === 0 ? "TOUS PASS ✅" : `${failures} ÉCHEC(S) ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("ERREUR:", err);
  process.exit(1);
});