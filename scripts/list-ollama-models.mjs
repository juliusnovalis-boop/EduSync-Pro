/**
 * Liste les modèles réellement disponibles sur le compte Ollama Cloud (GET /api/tags).
 * N'affiche JAMAIS la clé ni les headers. Usage : node scripts/list-ollama-models.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env"), "utf8");
const match = envText.match(/^OLLAMA_API_KEY=(.*)$/m);
const key = match ? match[1].trim().replace(/^"|"$/g, "") : "";
if (!key) {
  console.error("OLLAMA_API_KEY=MISSING");
  process.exit(1);
}
const base = (envText.match(/^OLLAMA_BASE_URL=(.*)$/m)?.[1] ?? "https://ollama.com").trim().replace(/"/g, "");

try {
  const res = await fetch(`${base}/api/tags`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error(`API status=${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  const models = (data.models ?? []).map((m) => m.name ?? m.model ?? "?");
  console.log("MODELES DU COMPTE (" + models.length + ") :");
  for (const m of models) console.log(" - " + m);
} catch (e) {
  console.error("NETWORK/ERROR: " + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
}
