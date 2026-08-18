/**
 * EDUSYNC AI POLICY — Couche indépendante de types, priorités et gratuité.
 *
 * Cette couche ne dépend ni de ai-router.ts ni de ai-gateway.ts.
 * Elle est la source de vérité partagée pour la sélection de provider/modèle.
 * Dépend uniquement de ai.ts (readSecret) pour la lecture des secrets.
 */
import { readSecret } from "./ai";

export type AiProviderId = "gemini" | "openrouter" | "huggingface";
export type AiTaskType = "quick" | "standard" | "analysis" | "vision" | "json" | "audio";
export type AiCapability = "chat" | "ocr" | "transcribe";
export interface AiProviderInfo { id: AiProviderId; label: string; priority: number; configured: boolean; enabled: boolean; }

export const PROVIDER_PRIORITY: AiProviderId[] = ["gemini", "openrouter", "huggingface"];
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const METADATA_TTL_MS = 15 * 60_000;

/* Centralized policy. HF remains disabled because routed inference is credit/pay-as-you-go;
 * unknown pricing is always denied. Gemini models are the approved free-tier candidates. */
const FREE_POLICY: Record<AiProviderId, { enabled: boolean; fallbackModels: string[]; requiresCostVerification?: boolean }> = {
  gemini: { enabled: true, fallbackModels: ["gemini-2.5-flash-lite", "gemini-2.5-flash"] },
  openrouter: { enabled: true, fallbackModels: ["openrouter/free"] },
  huggingface: { enabled: true, fallbackModels: [], requiresCostVerification: true },
};
export type ModelMetadata = { id: string; capabilities: string[]; verifiedFree: boolean; checkedAt: number };
const metadataCache = new Map<AiProviderId, { checkedAt: number; models: ModelMetadata[] }>();

function configured(provider: AiProviderId) {
  return Boolean(readSecret(provider === "gemini" ? ["GEMINI_API_KEY"] : provider === "openrouter" ? ["OPENROUTER_API_KEY"] : ["HF_TOKEN"]));
}
function providerEnabled(provider: AiProviderId) { return FREE_POLICY[provider].enabled && configured(provider); }

export function listProviders(): AiProviderInfo[] {
  return PROVIDER_PRIORITY.map((id, index) => ({ id, label: id === "gemini" ? "Google Gemini" : id === "openrouter" ? "OpenRouter Free" : "Hugging Face", priority: index + 1, configured: configured(id), enabled: providerEnabled(id) }));
}

/** AICostGuard: price zero only; all unknown or disabled paths are rejected. */
export function checkModelIsFree(provider: AiProviderId, model: string) {
  if (!providerEnabled(provider)) return { allowed: false as const, reason: "PROVIDER_DISABLED" };
  const id = model.trim().toLowerCase();
  if (provider === "openrouter") return { allowed: id === "openrouter/free" || id.endsWith(":free"), reason: "UNKNOWN_PRICING" };
  if (provider === "gemini") return { allowed: FREE_POLICY.gemini.fallbackModels.includes(id), reason: "UNKNOWN_PRICING" };
  return { allowed: false as const, reason: "UNKNOWN_PRICING" };
}

/** Dynamic OpenRouter model discovery. Failed discovery retains only the known-safe router. */
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
        models = [{ id: "openrouter/free", capabilities: ["chat"], verifiedFree: true, checkedAt: Date.now() }, ...discovered];
      }
    } catch { /* Preserve the last safe configuration; never broaden on failure. */ }
  }
  metadataCache.set(provider, { checkedAt: Date.now(), models });
  return models;
}

export function invalidateModelMetadata(provider?: AiProviderId) { if (provider) metadataCache.delete(provider); else metadataCache.clear(); }