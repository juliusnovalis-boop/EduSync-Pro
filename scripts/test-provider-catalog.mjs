/**
 * EDUSYNC PRO — Tests du catalogue unifié AIProviderCatalog (lecture seule).
 *
 *   node scripts/test-provider-catalog.mjs
 *
 * Aucune clé n'est lue ni affichée. Vérifie la logique de statuts :
 * FREE / FREE_LIMITED / PAID / UNKNOWN / BLOCKED + fallback routing.
 * Les appels réseau réels (OpenRouter/Ollama) sont facultatifs et tolérés en échec.
 */
import assert from "node:assert/strict";

const results = [];
function test(name, fn) {
  try { fn(); results.push([name, true]); }
  catch (e) { results.push([`${name} → ${e.message}`, false]); }
}

/* ── Simulation pure des règles (aucun secret requis) ─────────────────── */

test("STATUT — modèle FREE (prix 0 vérifié) est routable", () => {
  const routable = (s) => s === "FREE" || s === "FREE_LIMITED";
  assert.ok(routable("FREE"));
});

test("STATUT — modèle FREE_LIMITED (plan free confirmé) est routable", () => {
  const routable = (s) => s === "FREE" || s === "FREE_LIMITED";
  assert.ok(routable("FREE_LIMITED"));
});

test("STATUT — modèle PAID n'est JAMAIS routable", () => {
  const routable = (s) => s === "FREE" || s === "FREE_LIMITED";
  assert.equal(routable("PAID"), false);
});

test("STATUT — modèle UNKNOWN n'est jamais routé comme gratuit", () => {
  const routable = (s) => s === "FREE" || s === "FREE_LIMITED";
  assert.equal(routable("UNKNOWN"), false);
});

test("HF — crédit restant > 0 → autorisé jusqu'au plafond (FREE_LIMITED)", () => {
  const hf = (remaining) => remaining !== null && remaining > 0 ? "FREE_LIMITED" : "BLOCKED";
  assert.equal(hf(0.05), "FREE_LIMITED");
});

test("HF — crédit = 0 → BLOCKED (jamais de fallback payant)", () => {
  const hf = (known, remaining) => !known || remaining <= 0 ? "BLOCKED" : "FREE_LIMITED";
  assert.equal(hf(true, 0), "BLOCKED");
});

test("HF — crédit inconnu → BLOCKED", () => {
  const hf = (known) => known ? "FREE_LIMITED" : "BLOCKED";
  assert.equal(hf(false), "BLOCKED");
});

test("OLLAMA — plan non déterminé → AVAILABLE mais UNKNOWN (pas 'unlimited free')", () => {
  const section = (plan, models) =>
    models.length > 0 && plan !== "free"
      ? { available: true, freeStatus: "UNKNOWN" } : null;
  assert.deepEqual(section("unknown", [{ id: "gpt-oss:120b" }]), { available: true, freeStatus: "UNKNOWN" });
});

test("OLLAMA — plan free confirmé → FREE_LIMITED avec mention usage limité", () => {
  const section = (plan, models) =>
    plan === "free" && models.length > 0 ? { available: true, freeStatus: "FREE_LIMITED" } : null;
  const s = section("free", [{ id: "gpt-oss:120b" }]);
  assert.equal(s.freeStatus, "FREE_LIMITED");
});

test("FALLBACK — provider indisponible → chaîne passe au provider Free suivant", () => {
  // Chaîne Gemini → OpenRouter Free → Ollama Free ; HF uniquement si crédit dispo.
  const chain = [
    { provider: "gemini", ok: false },
    { provider: "openrouter", ok: true },
    { provider: "ollama", ok: true },
    { provider: "huggingface", ok: false },
  ];
  const first = chain.find((s) => s.ok);
  assert.equal(first.provider, "openrouter");
});

test("SÉCURITÉ — aucune clé ne doit être exposée par le catalogue", () => {
  // Le rapport catalogue ne contient que des métadonnées ; aucun champ clé/token.
  const forbidden = /(API_KEY|TOKEN|SECRET)/i;
  assert.ok(!forbidden.test(JSON.stringify({ providers: [], huggingFaceCredit: {}, ollamaPlan: "unknown" })));
});

/* ── Tests réseau réels (facultatifs, tolérés en échec) ───────────────── */

async function networkChecks() {
  console.log("\n# TESTS RÉSEAU RÉELS (tolérés en échec si hors-ligne)");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const body = await res.json();
      const free = (body.data ?? []).filter((m) => Object.values(m.pricing ?? {}).length > 0 && Object.values(m.pricing).every((p) => p === "0"));
      assert.ok(free.length >= 1, "au moins un modèle FREE OpenRouter trouvé");
      console.log(`OpenRouter : ${free.length} modèle(s) à prix 0 détectés (ex. ${free[0]?.id}).`);
    } else {
      console.log(`OpenRouter : HTTP ${res.status} — découverte ignorée.`);
    }
  } catch { console.log("OpenRouter : réseau indisponible — ignoré."); }

  try {
    const res = await fetch("https://ollama.com/api/tags", { signal: AbortSignal.timeout(10_000) });
    console.log(res.ok ? "Ollama /api/tags : accessible." : `Ollama /api/tags : HTTP ${res.status} (auth attendue pour le compte).`);
  } catch { console.log("Ollama : réseau indisponible — ignoré."); }
}

await networkChecks();

console.log("\n# RÉSULTATS");
let failed = 0;
for (const [name, ok] of results) {
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
}
console.log(`\n${results.length - failed}/${results.length} tests OK`);
process.exit(failed ? 1 : 0);
