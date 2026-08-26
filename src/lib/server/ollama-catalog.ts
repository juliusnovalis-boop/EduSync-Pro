/**
 * EDUSYNC PRO — Ollama Cloud : notion de PLAN et découverte dynamique des modèles
 * accessibles au compte via GET {OLLAMA_BASE_URL}/api/tags.
 *
 * ⚠️ /api/tags prouve la DISPONIBILITÉ d'un modèle, pas son prix individuel.
 * - Si OLLAMA_PLAN=free est explicitement confirmé → modèles proposés en
 *   FREE_LIMITED ("Free plan / usage limité").
 * - Sinon ("pro" ou "unknown") → AVAILABLE mais statut UNKNOWN : on ne prétend
 *   JAMAIS "unlimited free" et on n'invente aucune tarification.
 * La clé reste lue exclusivement côté serveur depuis .env (jamais loggée).
 */
import { readSecret } from "./ai";

export type OllamaPlan = "free" | "pro" | "unknown";

const TAGS_TTL_MS = 15 * 60_000;
let tagsCache: { at: number; models: { id: string; capabilities: string[] }[] } | null = null;

/** Plan du compte Ollama — confirmé UNIQUEMENT si OLLAMA_PLAN=free|pro dans .env. */
export function ollamaPlan(): OllamaPlan {
  const raw = (process.env.OLLAMA_PLAN ?? "").trim().toLowerCase();
  return raw === "free" ? "free" : raw === "pro" ? "pro" : "unknown";
}

function ollamaBase(): string {
  return (process.env.OLLAMA_BASE_URL ?? "https://ollama.com").replace(/\/+$/, "");
}

/**
 * Modèles réellement accessibles au compte (GET /api/tags, TTL 15 min).
 * Renvoie [] si non configuré ou erreur réseau — jamais d'exception bloquante
 * pour l'affichage du catalogue.
 */
export async function fetchOllamaAccountModels(): Promise<{ id: string; capabilities: string[] }[]> {
  if (!readSecret(["OLLAMA_API_KEY"])) return [];
  if (tagsCache && Date.now() - tagsCache.at < TAGS_TTL_MS) return tagsCache.models;
  let models: { id: string; capabilities: string[] }[] = [];
  try {
    const res = await fetch(`${ollamaBase()}/api/tags`, {
      headers: { Authorization: `Bearer ${readSecret(["OLLAMA_API_KEY"])}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const body = await res.json() as { models?: Array<{ name?: string; model?: string; capabilities?: string[] }> };
      models = (body.models ?? []).flatMap((m) => {
        const id = (m.name ?? m.model ?? "").trim().toLowerCase();
        return id ? [{ id, capabilities: m.capabilities?.length ? m.capabilities : ["chat"] }] : [];
      });
    }
  } catch { /* réseau indisponible → catalogue vide, jamais élargi */ }
  tagsCache = { at: Date.now(), models };
  return models;
}

export function invalidateOllamaTags() { tagsCache = null; }

/** Accès SYNCHRONE au dernier cache /api/tags valide (pour la politique FREE_ONLY). */
export function ollamaCachedAccountModels(): readonly string[] {
  return tagsCache ? tagsCache.models.map((m) => m.id) : [];
}
