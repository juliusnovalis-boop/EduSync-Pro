/**
 * Vérifie la config Ollama et la présence du/des modèles FREE_VERIFIED dans le compte.
 * N'affiche jamais la clé. Usage : node scripts/verify-ollama-ready.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env"), "utf8");
const getEnv = (name) => envText.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim().replace(/^"|"$/g, "") ?? "";

const key = getEnv("OLLAMA_API_KEY");
const base = getEnv("OLLAMA_BASE_URL") || "https://ollama.com";
const freeList = getEnv("OLLAMA_FREE_VERIFIED_MODELS").split(",").map((s) => s.trim()).filter(Boolean);

console.log("OLLAMA_API_KEY=" + (key ? "CONFIGURED" : "MISSING"));
console.log("OLLAMA_BASE_URL=" + (base ? "CONFIGURED" : "MISSING"));
console.log("OLLAMA_FREE_VERIFIED_MODELS=" + (freeList.length ? "CONFIGURED" : "MISSING"));
if (!key || !freeList.length) {
  console.error("STOP: configuration incomplète.");
  process.exit(1);
}
console.log("MODELES AUTORISES (FREE VERIFIED) : " + freeList.join(", "));

const res = await fetch(`${base}/api/tags`, {
  headers: { Authorization: `Bearer ${key}` },
  signal: AbortSignal.timeout(10_000),
});
if (!res.ok) {
  console.error("API status=" + res.status);
  process.exit(1);
}
const data = await res.json();
const accountModels = (data.models ?? []).map((m) => m.name ?? m.model ?? "?");
const missing = freeList.filter((f) => !accountModels.includes(f));
if (missing.length) {
  console.error("STOP: modèle(s) autorisé(s) ABSENT(S) du compte : " + missing.join(", "));
  process.exit(1);
}
console.log("PRESENCE DANS LE COMPTE : OK pour tous les modèles autorisés.");
process.exit(0);
