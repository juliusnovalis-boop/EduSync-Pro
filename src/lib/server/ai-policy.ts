/**
 * EDUSYNC AI POLICY — Couche indépendante de types, priorités et gratuité.
 *
 * Cette couche ne dépend ni de ai-router.ts ni de ai-gateway.ts.
 * Elle est la source de vérité partagée pour la sélection de provider/modèle.
 * Dépend uniquement de ai.ts (readSecret) pour la lecture des secrets.
 */
import { readSecret } from "./ai";
import { ollamaPlan, fetchOllamaAccountModels, ollamaCachedAccountModels, invalidateOllamaTags } from "./ollama-catalog";

export type AiProviderId = "gemini" | "openrouter" | "huggingface" | "ollama";
export type AiTaskType = "quick" | "standard" | "analysis" | "vision" | "json" | "audio";
export type AiCapability = "chat" | "ocr" | "transcribe";
export interface AiProviderInfo { id: AiProviderId; label: string; priority: number; configured: boolean; enabled: boolean; }

export const PROVIDER_PRIORITY: AiProviderId[] = ["gemini", "openrouter", "huggingface", "ollama"];
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const METADATA_TTL_MS = 15 * 60_000;

/* Centralized policy. HF remains disabled because routed inference is credit/pay-as-you-go;
 * unknown pricing is always denied. Gemini models are the approved free-tier candidates.
 * OLLAMA : provider activable MAIS aucun modèle n'est gratuit par défaut — le pricing
 * cloud Ollama est inconnu/non vérifiable automatiquement. Un modèle n'est autorisé que
 * s'il est explicitement FREE_VERIFIED côté hébergeur (OLLAMA_FREE_VERIFIED_MODELS),
 * après preuve humaine de gratuité exploitable (ex. plan incluant ces modèles). */
const FREE_POLICY: Record<AiProviderId, { enabled: boolean; fallbackModels: string[]; requiresCostVerification?: boolean }> = {
  gemini: { enabled: true, fallbackModels: ["gemini-2.5-flash-lite", "gemini-2.5-flash"] },
  openrouter: { enabled: true, fallbackModels: ["openrouter/free"] },
  huggingface: { enabled: true, fallbackModels: [], requiresCostVerification: true },
  ollama: { enabled: true, fallbackModels: [], requiresCostVerification: true },
};

/** Modèles Ollama explicitement vérifiés gratuits — preuve HUMAINE configurée par
 * l'hébergeur via OLLAMA_FREE_VERIFIED_MODELS (liste séparée par virgules).
 * Vide par défaut : sans preuve exploitable, tout modèle Ollama est BLOQUÉ.
 * Le catalogue ai-models.ts ne constitue PAS une preuve de gratuité. */
const OLLAMA_FREE_VERIFIED_MODELS: readonly string[] = (process.env.OLLAMA_FREE_VERIFIED_MODELS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
export type ModelMetadata = { id: string; capabilities: string[]; verifiedFree: boolean; checkedAt: number; limited?: boolean };
const metadataCache = new Map<AiProviderId, { checkedAt: number; models: ModelMetadata[] }>();

function configured(provider: AiProviderId) {
  switch (provider) {
    case "gemini": return Boolean(readSecret(["GEMINI_API_KEY"]));
    case "openrouter": return Boolean(readSecret(["OPENROUTER_API_KEY"]));
    case "ollama": return Boolean(readSecret(["OLLAMA_API_KEY"]));
    default: return Boolean(readSecret(["HF_TOKEN"]));
  }
}
function providerEnabled(provider: AiProviderId) { return FREE_POLICY[provider].enabled && configured(provider); }

export function listProviders(): AiProviderInfo[] {
  const labelFor: Record<string, string> = { gemini: "Google Gemini", openrouter: "OpenRouter Free", ollama: "Ollama Cloud" };
  return PROVIDER_PRIORITY.map((id, index) => ({ id, label: labelFor[id] ?? id, priority: index + 1, configured: configured(id), enabled: providerEnabled(id) }));
}

/** AICostGuard: price zero only; all unknown or disabled paths are rejected. */
export function checkModelIsFree(provider: AiProviderId, model: string) {
  if (!providerEnabled(provider)) return { allowed: false as const, reason: "PROVIDER_DISABLED" };
  const id = model.trim().toLowerCase();
  if (provider === "openrouter") return { allowed: id === "openrouter/free" || id.endsWith(":free"), reason: "UNKNOWN_PRICING" };
  if (provider === "gemini") return { allowed: FREE_POLICY.gemini.fallbackModels.includes(id), reason: "UNKNOWN_PRICING" };
  if (provider === "ollama") {
    // (1) Preuve HUMAINE explicite (OLLAMA_FREE_VERIFIED_MODELS) → autorisé.
    if (OLLAMA_FREE_VERIFIED_MODELS.includes(id)) return { allowed: true as const, reason: "FREE_VERIFIED" };
    // (2) Plan Free explicitement confirmé (OLLAMA_PLAN=free) ET modèle réellement
    //     accessible au compte (/api/tags) → autorisé en FREE_LIMITED ("usage limité").
    if (ollamaPlan() === "free" && ollamaCachedAccountModels().includes(id)) {
      return { allowed: true as const, reason: "FREE_PLAN_LIMITED" };
    }
    // Sinon : pricing cloud inconnu/non prouvé gratuit → BLOQUÉ strict.
    return { allowed: false as const, reason: "UNKNOWN_PRICING" };
  }
  return { allowed: false as const, reason: "UNKNOWN_PRICING" };
}

/** Découverte dynamique : OpenRouter (prix 0) et Ollama (modèles du compte si plan Free confirmé).
 * Failed discovery retains only the known-safe router. */
export async function resolveFreeModels(provider: AiProviderId): Promise<ModelMetadata[]> {
  const cached = metadataCache.get(provider);
  if (cached && Date.now() - cached.checkedAt < METADATA_TTL_MS) return cached.models;
  let models: ModelMetadata[] = FREE_POLICY[provider].fallbackModels.map((id) => ({ id, capabilities: ["chat"], verifiedFree: true, checkedAt: Date.now() }));
  if (provider === "openrouter" && configured(provider)) {
    try {
      const res = await fetch(OPENROUTER_MODELS_URL, { headers: { Authorization: `Bearer ${readSecret(["OPENROUTER_API_KEY"])}` }, signal: AbortSignal.timeout(8_000) });
      if (res.ok) {
        const body = await res.json() as { data?: Array<{ id?: string; pricing?: Record<string, string>; input_modalities?: string[] }> };
        const discovered = (body.data ?? []).flatMap((item) => {
          const prices = Object.values(item.pricing ?? {});
          return prices.length > 0 && prices.every((price) => price === "0") && item.id
            ? [{ id: item.id, capabilities: item.input_modalities ?? ["text"], verifiedFree: true, checkedAt: Date.now() }] : [];
        });
        // Déduplication par identité (model id, insensible à la casse) :
        // l'API OpenRouter renvoie aussi "openrouter/free", déjà présent via le
        // fallback → on conserve la première occurrence (fallback prioritaire)
        // au lieu de produire un doublon de clé React côté catalogue.
        const merged = new Map<string, ModelMetadata>();
        for (const m of models) merged.set(m.id.trim().toLowerCase(), m);
        for (const d of discovered) {
          const key = d.id.trim().toLowerCase();
          if (!merged.has(key)) merged.set(key, d);
        }
        models = [...merged.values()];
      }
    } catch { /* Preserve the last safe configuration; never broaden on failure. */ }
  } else if (provider === "ollama" && configured(provider)) {
    // Plan Free explicitement confirmé → modèles réellement accessibles au compte,
    // proposés en FREE_LIMITED (usage limité). Sinon aucun modèle n'est élargi.
    invalidateOllamaTags();
    const plan = ollamaPlan();
    if (plan === "free") {
      const account = await fetchOllamaAccountModels();
      models = account.map((m) => ({ id: m.id, capabilities: m.capabilities, verifiedFree: true, limited: true, checkedAt: Date.now() }));
    } else {
      models = OLLAMA_FREE_VERIFIED_MODELS.map((id) => ({ id, capabilities: ["chat"], verifiedFree: true, checkedAt: Date.now() }));
    }
  }
  metadataCache.set(provider, { checkedAt: Date.now(), models });
  return models;
}

export function invalidateModelMetadata(provider?: AiProviderId) { if (provider) metadataCache.delete(provider); else metadataCache.clear(); }