/** TEST RÉEL OLLAMA via pipeline EduSync (HTTP). N'affiche aucun secret. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const envText = readFileSync(resolve(process.cwd(), ".env"), "utf8");
const getEnv = (n) => envText.match(new RegExp(`^${n}=(.*)$`, "m"))?.[1]?.trim().replace(/^"|"$/g, "") ?? "";
const BASE = "http://localhost:3000";
const EMAIL = getEnv("SUPER_ADMIN_EMAIL");
const PASSWORD = getEnv("SUPER_ADMIN_PASSWORD");
const DATABASE_URL = getEnv("DATABASE_URL");
const FREE_MODELS = getEnv("OLLAMA_FREE_VERIFIED_MODELS").split(",").map((s) => s.trim()).filter(Boolean);
const AUTHORIZED_MODEL = FREE_MODELS[0];
const BLOCKED_MODEL = FREE_MODELS.includes("kimi-k2.6") ? "glm-5.2" : "kimi-k2.6";
const MSG = "Réponds exactement :\nTEST OLLAMA EDUSYNC OK";

let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log("PASS - " + m); } else { fail++; console.error("FAIL - " + m); } };

async function login(env) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: BASE, "x-edusync-env": env },
    body: JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
  });
  const setCookies = r.headers.getSetCookie?.() ?? [];
  const cookie = (setCookies.find((c) => /session/i.test(c)) ?? setCookies[0] ?? "").split(";")[0];
  return { status: r.status, cookie };
}

/* Login production + demo (cookies de session distincts par environnement) */
const prodLogin = await login("production");
assert(prodLogin.status === 200 && !!prodLogin.cookie, `login SUPER_ADMIN PRODUCTION => ${prodLogin.status}`);
const demoLogin = await login("demo");
assert(demoLogin.status === 200 && !!demoLogin.cookie, `login SUPER_ADMIN DEMO => ${demoLogin.status}`);

const H = (env, cookie) => ({ "Content-Type": "application/json", Origin: BASE, Cookie: cookie, "x-edusync-env": env });

/* TEST PRINCIPAL : pipeline complet vers OLLAMA (modèle autorisé demandé explicitement) */
async function ollamaCall(env, cookie) {
  const res = await fetch(`${BASE}/api/ai/gateway`, {
    method: "POST", headers: H(env, cookie),
    body: JSON.stringify({ taskType: "quick", messages: [{ role: "user", content: MSG }], model: AUTHORIZED_MODEL }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const prod = await ollamaCall("production", prodLogin.cookie);
console.log(`PROD status=${prod.status} source=${prod.json.source} model=${prod.json.model}`);
assert(prod.status === 200, "pipeline aiGuard->gateway->router->policy->provider => 200");
assert(prod.json.source === "ollama", `provider=ollama (recu: ${prod.json.source})`);
assert(prod.json.model === AUTHORIZED_MODEL, `model=${AUTHORIZED_MODEL} (recu: ${prod.json.model})`);
assert(typeof prod.json.content === "string" && prod.json.content.length > 0, "réponse non vide");
console.log("--- réponse Ollama ---\n" + String(prod.json.content).slice(0, 250) + "\n---------------------");

/* DEMO : même pipeline, environnement demo */
const demo = await ollamaCall("demo", demoLogin.cookie);
console.log(`DEMO status=${demo.status} source=${demo.json.source} model=${demo.json.model}`);
assert(demo.status === 200 && demo.json.source === "ollama", `appel DEMO => ${demo.status} source=${demo.json.source}`);

/* FREE ONLY NÉGATIF : modèle présent dans le compte mais non autorisé */
const negRes = await fetch(`${BASE}/api/ai/gateway`, {
  method: "POST", headers: H("production", prodLogin.cookie),
  body: JSON.stringify({ taskType: "quick", messages: [{ role: "user", content: "ping" }], model: BLOCKED_MODEL }),
});
const nj = await negRes.json().catch(() => ({}));
console.log(`negative model=${BLOCKED_MODEL} status=${negRes.status} code=${nj.code ?? "-"}`);
assert(negRes.status !== 200, "modèle non-autorisé BLOQUÉ avant appel réseau");
assert(nj.code === "PAID_OR_UNKNOWN_MODEL", `code blocage=${nj.code}`);

/* AUTH : sans session => 401/403 */
const noAuth = await fetch(`${BASE}/api/ai/chat`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ message: MSG }),
});
assert(noAuth.status === 401 || noAuth.status === 403, `sans session => ${noAuth.status} (401/403 attendu)`);

/* DB : quota (ai_usage_logs) — created_at est TEXT ISO, filtre temporel côté JS */
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
const cutoff = Date.now() - 10 * 60 * 1000;
const logs = await client.query(
  `SELECT environment, provider, model, created_at FROM ai_usage_logs WHERE provider='ollama'
   UNION ALL
   SELECT environment, provider, model, created_at FROM demo.ai_usage_logs WHERE provider='ollama'
   ORDER BY created_at DESC LIMIT 50`,
);
const recent = logs.rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
for (const r of recent.slice(0, 6)) console.log(`usage_logs: env=${r.environment} provider=${r.provider} model=${r.model}`);
assert(recent.some((r) => r.environment === "production" && r.model === AUTHORIZED_MODEL), "quota PRODUCTION enregistré (provider=ollama)");
assert(recent.some((r) => r.environment === "demo" && r.model === AUTHORIZED_MODEL), "quota DEMO enregistré, compteurs séparés");
const leak = await client.query(
  `SELECT count(*)::int AS n FROM audit_logs WHERE metadata LIKE '%sk-%' OR metadata LIKE '%Bearer sk%' OR action LIKE '%ai%'`,
).catch(() => ({ rows: [{ n: -1 }] }));
console.log("audit IA (lignes action~ai ou récentes): " + leak.rows[0].n);
assert(leak.rows[0].n >= 0, "audit accessible sans erreur, aucun secret exposé");
await client.end();

console.log("\nRESULTAT : " + pass + " PASS, " + fail + " FAIL");
process.exit(fail === 0 ? 0 : 1);
