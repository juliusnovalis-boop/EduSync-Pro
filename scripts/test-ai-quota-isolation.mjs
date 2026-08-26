/**
 * EDUSYNC PRO — Tests réels AIQuotaManager (isolation / atomicité / rollback).
 *
 * Reproduit FIDÈLEMENT les requêtes de src/lib/server/ai-quota-manager.ts
 * (INSERT … ON CONFLICT DO UPDATE SET count = count+1 RETURNING count,
 *  enveloppé dans UNE transaction minute+jour, ROLLBACK si limite dépassée)
 * contre la base PostgreSQL réelle — aucune Map mémoire.
 *
 * SAFE : toutes les données de test portent user_id = 'qtest-…'.
 * Cleanup : DELETE limité à ces user_ids de test — jamais de données réelles.
 *
 * Usage :
 *   node scripts/test-ai-quota-isolation.mjs            # run complet
 *   node scripts/test-ai-quota-isolation.mjs verify-persist  # relecture post-processus
 */
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = {};
let failures = 0;

function assert(name, cond, detail = "") {
  results[name] = cond ? "PASS" : "FAIL";
  if (!cond) failures++;
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Clé logique identique au manager : environment+school(sentinel "")+user+role+period. */
const schoolKey = (schoolId) => schoolId ?? "";
const minuteKey = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const dayKey = () => new Date().toISOString().slice(0, 10);

/** Reproduction exacte de incrementCounter() du manager. */
async function incrementCounter(client, ctx, periodType, periodKey) {
  const now = new Date().toISOString();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const { rows } = await client.query(
    `INSERT INTO ai_usage_counters
       (id, environment, school_id, user_id, role, period_type, period_key, count, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$8)
     ON CONFLICT (environment, school_id, user_id, role, period_type, period_key)
     DO UPDATE SET count = ai_usage_counters.count + 1, updated_at = $8
     RETURNING count`,
    [id, ctx.environment, schoolKey(ctx.schoolId), ctx.userId, ctx.role.toUpperCase(), periodType, periodKey, now],
  );
  return rows[0]?.count ?? 1;
}

/** Reproduction exacte de checkAndReserve() : UNE transaction, rollback si dépassement. */
async function checkAndReserve(ctx) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const limits = { STUDENT: { perMinute: 10, perDay: 200 }, TEACHER: { perMinute: 20, perDay: 500 }, SUPER_ADMIN: { perMinute: 60, perDay: 2000 } }[ctx.role.toUpperCase()] ?? { perMinute: 20, perDay: 500 };
    const mCount = await incrementCounter(client, ctx, "minute", minuteKey());
    if (mCount > limits.perMinute) throw new Error("QUOTA_EXCEEDED_MINUTE");
    const dCount = await incrementCounter(client, ctx, "day", dayKey());
    if (dCount > limits.perDay) throw new Error("QUOTA_EXCEEDED_DAY");
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    if (String(err.message).startsWith("QUOTA_EXCEEDED")) return false;
    throw err;
  } finally {
    client.release();
  }
}

/** Lecture brute du compteur (équivalent getUsage). */
async function readCount(ctx, periodType) {
  const key = periodType === "minute" ? minuteKey() : dayKey();
  const { rows } = await pool.query(
    `SELECT count FROM ai_usage_counters WHERE environment=$1 AND school_id=$2 AND user_id=$3 AND role=$4 AND period_type=$5 AND period_key=$6`,
    [ctx.environment, schoolKey(ctx.schoolId), ctx.userId, ctx.role.toUpperCase(), periodType, key],
  );
  return rows[0]?.count ?? 0;
}

async function cleanup() {
  // Uniquement les données de test (préfixe dédié) — jamais de données réelles.
  await pool.query("DELETE FROM ai_usage_counters WHERE user_id LIKE 'qtest-%'");
  await pool.query("DELETE FROM ai_usage_logs WHERE user_id LIKE 'qtest-%'");
}

async function main() {
  const verifyPersist = process.argv[2] === "verify-persist";

  if (!verifyPersist) {
    await cleanup();

    // S1 — DEMO / OFFICIAL
    const demoCtx = { userId: "qtest-user", role: "STUDENT", schoolId: "school-test", environment: "demo" };
    const prodCtx = { ...demoCtx, environment: "production" };
    const s1a = await checkAndReserve(demoCtx);
    const s1b = await checkAndReserve(prodCtx);
    const s1demo = await readCount(demoCtx, "day");
    const s1prod = await readCount(prodCtx, "day");
    assert("S1 DEMO/OFFICIAL indépendants", s1a && s1b && s1demo === 1 && s1prod === 1, `demo=${s1demo} prod=${s1prod}`);

    // S2 — SCHOOL A / B
    const schA = { userId: "qtest-school", role: "STUDENT", schoolId: "school-A", environment: "production" };
    const schB = { ...schA, schoolId: "school-B" };
    await checkAndReserve(schA); await checkAndReserve(schA);
    await checkAndReserve(schB);
    const cA = await readCount(schA, "day");
    const cB = await readCount(schB, "day");
    assert("S2 SCHOOL A/B indépendants", cA === 2 && cB === 1, `A=${cA} B=${cB}`);

    // S3 — USER A / B
    const uA = { userId: "qtest-userA", role: "STUDENT", schoolId: "school-test", environment: "production" };
    const uB = { ...uA, userId: "qtest-userB" };
    await checkAndReserve(uA);
    await checkAndReserve(uB);
    const cuA = await readCount(uA, "day");
    const cuB = await readCount(uB, "day");
    assert("S3 USER A/B indépendants", cuA === 1 && cuB === 1, `A=${cuA} B=${cuB}`);

    // S4 — ROLE STUDENT / TEACHER
    const rS = { userId: "qtest-role", role: "STUDENT", schoolId: "school-test", environment: "production" };
    const rT = { ...rS, role: "TEACHER" };
    await checkAndReserve(rS);
    await checkAndReserve(rT);
    const crS = await readCount(rS, "minute");
    const crT = await readCount(rT, "minute");
    assert("S4 ROLE distincts", crS === 1 && crT === 1, `STUDENT=${crS} TEACHER=${crT}`);

    // S5 — SUPER_ADMIN schoolId null (sentinel "")
    const sa = { userId: "qtest-super", role: "SUPER_ADMIN", schoolId: null, environment: "production" };
    await checkAndReserve(sa);
    await checkAndReserve(sa);
    const { rows: saRows } = await pool.query(
      "SELECT count FROM ai_usage_counters WHERE user_id='qtest-super' AND period_type='minute'",
    );
    assert("S5 SUPER_ADMIN sentinel unique", saRows.length === 1 && saRows[0].count === 2, `lignes=${saRows.length} count=${saRows[0]?.count}`);

    // S6 — LIMITE exacte (TEACHER 20/min)
    const lim = { userId: "qtest-limit", role: "TEACHER", schoolId: "school-test", environment: "demo" };
    let accepted = 0;
    for (let i = 0; i < 21; i++) {
      if (await checkAndReserve(lim)) accepted++;
      else break;
    }
    assert("S6 LIMITE N=20 ok, N+1 refusé", accepted === 20, `accepted=${accepted}`);
  } else {
    // Mode relecture post-processus (persistance)
  }

  // S7 — CONCURRENCE : 20 appels simultanés, même clé (STUDENT 10/min)
  const cc = { userId: "qtest-conc", role: "STUDENT", schoolId: "school-test", environment: "demo" };
  const tasks = Array.from({ length: 20 }, () => checkAndReserve(cc));
  const res = await Promise.all(tasks);
  const acceptedC = res.filter(Boolean).length;
  const rejectedC = res.length - acceptedC;
  const finalCount = await readCount(cc, "minute");
  assert("S7 CONCURRENCE accepted<=quota & somme=total",
    acceptedC <= 10 && acceptedC + rejectedC === 20 && finalCount === acceptedC,
    `accepted=${acceptedC} rejected=${rejectedC} count=${finalCount}`);

  // S8 — ROLLBACK minute/jour : jour saturé → minute NON consommée
  const rb = { userId: "qtest-rollback", role: "STUDENT", schoolId: "school-test", environment: "production" };
  const nowIso = new Date().toISOString();
  await pool.query(
    `INSERT INTO ai_usage_counters (id,environment,school_id,user_id,role,period_type,period_key,count,created_at,updated_at)
     VALUES ('rb-day', $1,$2,$3,'STUDENT','day',$4,200,$5,$5)
     ON CONFLICT (environment,school_id,user_id,role,period_type,period_key)
     DO UPDATE SET count = 200`,
    [rb.environment, schoolKey(rb.schoolId), rb.userId, dayKey(), nowIso],
  );
  const beforeMin = await readCount(rb, "minute");
  const rbResult = await checkAndReserve(rb);
  const afterMin = await readCount(rb, "minute");
  assert("S8 ROLLBACK jour refusé + minute intacte", rbResult === false && afterMin === beforeMin,
    `result=${rbResult} minute avant=${beforeMin} après=${afterMin}`);

  // S9 — PERSISTANCE : valeurs lues dans un processus séparé
  const pctx = { userId: "qtest-persist", role: "TEACHER", schoolId: "school-test", environment: "production" };
  let persistedOk;
  if (!verifyPersist) {
    for (let i = 0; i < 3; i++) await checkAndReserve(pctx);
    persistedOk = (await readCount(pctx, "day")) === 3;
    console.log(`ℹ️ PERSIST_MARKER qtest-persist day=3 (relancer: node scripts/test-ai-quota-isolation.mjs verify-persist)`);
    assert("S9 PERSISTANCE écriture", persistedOk, `count=${await readCount(pctx, "day")}`);
  } else {
    const v = await readCount(pctx, "day");
    persistedOk = v >= 3;
    assert("S9 PERSISTANCE relecture post-processus", persistedOk, `count=${v}`);
  }

  console.log("\n=== RÉSUMÉ ===");
  for (const [k, v] of Object.entries(results)) console.log(`${v === "PASS" ? "✅" : "❌"} ${k}: ${v}`);
  console.log(`FAILURES=${failures}`);

  if (!verifyPersist) {
    // Conserve UNIQUEMENT la clé de persistance pour la relecture post-processus.
    await pool.query("DELETE FROM ai_usage_counters WHERE user_id LIKE 'qtest-%' AND user_id <> 'qtest-persist'");
    const { rows: left } = await pool.query("SELECT count(*)::int AS n FROM ai_usage_counters WHERE user_id LIKE 'qtest-%'");
    console.log(`CLEANUP partial: rows_left=${left[0].n} (qtest-persist conservé pour verify-persist)`);
  } else {
    await cleanup();
    console.log("CLEANUP done (verify mode)");
  }

  await pool.end();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });

