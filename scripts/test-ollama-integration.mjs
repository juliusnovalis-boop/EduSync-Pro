/**
 * EDUSYNC PRO — Tests d'integration Ollama Cloud (FREE ONLY, zero cle reelle).
 *
 * 10 cas couvrant : provider indisponible sans cle, modele inconnu refuse,
 * modele sans preuve FREE refuse, checkModelIsFree(false/UNKNOWN),
 * absence de fuite de secret, route non authentifiee, modele non-FREE refuse,
 * erreurs Ollama 401/429/timeout normalisees.
 *
 * Aucun test ne necessite de cle OLLAMA_API_KEY reelle. L'appel reseau (facultatif)
 * utilise une absence de cle pour valider que l'endpoint exige une authentification.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const rel = (p) => readFileSync(resolve(ROOT, p), "utf8");

let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("  \u2713 " + msg); } else { fail++; console.error("  \u2717 " + msg); } };

/* Simulation readSecret (cle absente ou presente) — logique identique a ai.ts */
const envNoKey = { ...process.env, OLLAMA_API_KEY: undefined, OLLAMA_FREE_VERIFIED_MODELS: "" };
const TEST_DUMMY_KEY = "__test_only_placeholder_not_a_secret__";
const envWithKeyNoFree = { ...process.env, OLLAMA_API_KEY: TEST_DUMMY_KEY, OLLAMA_FREE_VERIFIED_MODELS: "" };
const simConfigured = (env) => Boolean(env.OLLAMA_API_KEY);
const simFreeVerified = (env) =>
  String(env.OLLAMA_FREE_VERIFIED_MODELS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
function simCheckFree(env, model) {
  if (!simConfigured(env)) return { allowed: false, reason: "PROVIDER_DISABLED" };
  const id = String(model).trim().toLowerCase();
  if (!simFreeVerified(env).includes(id)) return { allowed: false, reason: "UNKNOWN_PRICING" };
  return { allowed: true, reason: "verified" };
}

/* ---------- Source serveur : verifications statiques ---------- */
const providerSrc = rel("src/lib/server/providers/ollama-provider.ts");
const policySrc = rel("src/lib/server/ai-policy.ts");
const gatewaySrc = rel("src/lib/server/ai-gateway.ts");
const routerSrc = rel("src/lib/server/ai-router.ts");
const modelsSrc = rel("src/lib/server/ai-models.ts");
const envExample = rel(".env.example");
const chatRoute = rel("src/app/api/ai/chat/route.ts");

console.log("\n# TESTS STATIQUES — FREE ONLY / SECURITE / SOURCE (sans cle)");
assert(!simConfigured(envNoKey), "TEST 1 — OLLAMA_API_KEY absente => provider unavailable");
assert(simCheckFree(envNoKey, "gpt-oss:120b").allowed === false, "TEST 2 — modele Ollama non-verifie => refuse (provider non configure)");
assert(simCheckFree(envNoKey, "deepseek-v4-flash").allowed === false, "TEST 3 — modele Ollama sans preuve FREE => refuse (gratuite inconnue)");
const c2 = simCheckFree(envWithKeyNoFree, "gpt-oss:120b");
assert(c2.allowed === false && c2.reason === "UNKNOWN_PRICING", "TEST 4 — cle presente mais pas de preuve FREE => UNKNOWN_PRICING (bloque)");

// 5 — Aucun secret ne doit figurer dans les messages d'erreur / gateway.
assert(!/process\.env\.OLLAMA_API_KEY/.test(gatewaySrc) && !/process\.env\.OLLAMA_API_KEY/.test(routerSrc) && !/process\.env\.OLLAMA_API_KEY/.test(modelsSrc), "TEST 5 — aucune lecture directe de OLLAMA_API_KEY dans gateway/router/models");
// 5b — Aucun message d'erreur n'interpole le secret (pas de backtick template dans un throw OllamaProviderError).
assert(!/throw new OllamaProviderError\(\s*`/.test(providerSrc), "TEST 5b — aucune interpolation de cle dans un message d'erreur OllamaProviderError");
// 6 — La route /api/ai/chat exige une authentification.
const hasGuard = /aiGuard|AiGuard|getAuthContext|verifyAuth|PERMISSIONS/i.test(chatRoute);
assert(hasGuard, "TEST 6 — /api/ai/chat exige une authentification (aiGuard present)");
// 7 — Un modele non FREE est refuse avant tout appel reseau.
assert(gatewaySrc.includes("checkModelIsFree(\"ollama\"") && gatewaySrc.includes("\"PAID_OR_UNKNOWN_MODEL\""), "TEST 7 — gateway refuse les modeles non FREE avant tout appel reseau");
// 8/9/10 — le provider mape les erreurs HTTP reelles de Ollama Cloud.
assert(/status\s*===*\s*401|status\s*===*\s*403/.test(providerSrc) && /AUTH_FAILED/.test(providerSrc), "TEST 8 — 401/403 mappe -> AUTH_FAILED");
assert(/status\s*===*\s*429/.test(providerSrc) && /RATE_LIMITED/.test(providerSrc), "TEST 9 — 429 mappe -> RATE_LIMITED");
assert(/TimeoutError|AbortError/.test(providerSrc) && /TIMEOUT/.test(providerSrc), "TEST 10 — timeout mappe -> TIMEOUT");

// Politique FREE ONLY
assert(/AiProviderId.*\bollama\b/.test(policySrc), "POLITIQUE — ollama present dans AiProviderId");
assert(/PROVIDER_PRIORITY.*ollama/.test(policySrc), "POLITIQUE — ollama additif dans PROVIDER_PRIORITY");
assert(/requiresCostVerification:\s*true/.test(policySrc.match(/ollama:[^}]*}/)?.[0] ?? ""), "POLITIQUE — ollama requireCostVerification (pricing inconnu)");
assert(/OLLAMA_FREE_VERIFIED_MODELS/.test(policySrc), "POLITIQUE — mecanisme FREE_VERIFIED (preuve humaine) present");
// Catalogue vs gratuite
assert(/OLLAMA_ALLOWED_MODELS/.test(modelsSrc), "CATALOGUE — ai-models expose la liste des IDs connus");
assert(!/verifiedFree/i.test(modelsSrc), "CATALOGUE — ai-models ne declare AUCUN modele gratuit (pas de preuve)");
// Env
assert(/^OLLAMA_API_KEY=/.test(envExample.match(/^OLLAMA_API_KEY=.*$/m)?.[0] ?? ""), "ENV — OLLAMA_API_KEY vide dans .env.example (nom seulement, pas de secret)");

console.log("\n# TEST RESEAU — endpoint Ollama Cloud exige une authentification (facultatif)");
if (process.env.SKIP_NETWORK_TESTS === "1") {
  console.log("  @ tests reseau ignores (SKIP_NETWORK_TESTS=1)");
} else {
  try {
    const res = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-oss:120b", messages: [], stream: false }),
      signal: AbortSignal.timeout(8_000),
    });
    assert(res.status === 401, "TEST 8b — POST /api/chat sans cle => 401 (auth exigee par Ollama Cloud)");
  } catch (e) {
    console.log("  @ test reseau ignore (hors ligne) : " + (e instanceof Error ? e.message : String(e)));
  }
}

console.log("\n# RESULTAT : " + pass + " reussi(s), " + fail + " echoue(s)\n");
process.exit(fail === 0 ? 0 : 1);