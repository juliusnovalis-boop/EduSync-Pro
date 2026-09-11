/**
 * EDUSYNC PRO — AIProviderCatalog : catalogue UNIFIÉ des providers/modèles IA.
 *
 * Source unique pour l'affichage dynamique des providers dans l'interface
 * (page Settings / Assistant IA). AUCUNE clé n'est lue ici côté client :
 * tout est résolu serveur et renvoyé sans secret via /api/ai/catalog.
 *
 * Statuts possibles :
 *   FREE         — gratuité prouvée (prix réel 0)
 *   FREE_LIMITED — plan gratuit confirmé mais usage limité (plan Free Ollama,
 *                  crédit HF restant > 0 plafonné)
 *   PAID         — payant → jamais routable
 *   UNKNOWN      — prix/plan indéterminable → jamais routé comme "unlimited free"
 *   BLOCKED      — indisponible ou crédit épuisé
 */
import { readSecret } from "./ai";
import { resolveFreeModels, PROVIDER_PRIORITY, type AiProviderId } from "./ai-policy";
import { ollamaPlan, fetchOllamaAccountModels } from "./ollama-catalog";
import { isTokeninConfigured, tokeninListModels, tokeninCatalogSource } from "./providers/tokenin-provider";

export type AiFreeStatus = "FREE" | "FREE_LIMITED" | "PAID" | "UNKNOWN" | "BLOCKED";

export interface CatalogModel {
  provider: AiProviderId;
  model: string;
  available: boolean;
  freeStatus: AiFreeStatus;
  pricingStatus: string;
  capabilities: string[];
  reason: string;
}

export interface ProviderCatalogSection {
  provider: AiProviderId;
  label: string;
  configured: boolean;
  available: boolean;
  freeStatus: AiFreeStatus;
  summary: string;
  models: CatalogModel[];
}

export interface AiProviderCatalogReport {
  checkedAt: string;
  providers: ProviderCatalogSection[];
  huggingFaceCredit: { limit: number | null; remaining: number | null; known: boolean };
  ollamaPlan: "free" | "pro" | "unknown";
}

const CATALOG_TTL_MS = 15 * 60_000;
let catalogCache: { at: number; report: AiProviderCatalogReport } | null = null;

const LABELS: Record<AiProviderId, string> = {
  gemini: "Gemini",
  openrouter: "OpenRouter",
  ollama: "Ollama Cloud",
  huggingface: "Hugging Face",
  tokenin: "TOKEN FREE IA",
};

/** Modèles du niveau gratuit Gemini (politique existante). */
const GEMINI_FREE_MODELS: readonly { id: string; capabilities: string[] }[] = [
  { id: "gemini-2.5-flash-lite", capabilities: ["chat", "text"] },
  { id: "gemini-2.5-flash", capabilities: ["chat", "text"] },
];

function isConfigured(provider: AiProviderId): boolean {
  switch (provider) {
    case "gemini": return Boolean(readSecret(["GEMINI_API_KEY"]));
    case "openrouter": return Boolean(readSecret(["OPENROUTER_API_KEY"]));
    case "ollama": return Boolean(readSecret(["OLLAMA_API_KEY"]));
    case "huggingface": return Boolean(readSecret(["HF_TOKEN"]));
    case "tokenin": return Boolean(readSecret(["TOKEN_API_KEY"]));
    default: return false;
  }
}

async function geminiSection(): Promise<ProviderCatalogSection> {
  const configured = isConfigured("gemini");
  return {
    provider: "gemini", label: LABELS.gemini, configured, available: configured,
    freeStatus: configured ? "FREE" : "BLOCKED",
    summary: configured ? "🟢 Free" : "🔴 Non configuré",
    models: GEMINI_FREE_MODELS.map((m) => ({
      provider: "gemini", model: m.id, available: configured,
      freeStatus: (configured ? "FREE" : "BLOCKED") as AiFreeStatus,
      pricingStatus: "FREE_TIER", capabilities: m.capabilities,
      reason: configured ? "Niveau gratuit Google confirmé" : "GEMINI_API_KEY absente (.env)",
    })),
  };
}

async function openRouterSection(): Promise<ProviderCatalogSection> {
  const configured = isConfigured("openrouter");
  if (!configured) {
    return {
      provider: "openrouter", label: LABELS.openrouter, configured: false, available: false,
      freeStatus: "BLOCKED", summary: "🔴 Non configuré",
      models: [{ provider: "openrouter", model: "openrouter/free", available: false, freeStatus: "BLOCKED" as AiFreeStatus, pricingStatus: "FREE_ROUTER", capabilities: ["chat"], reason: "OPENROUTER_API_KEY absente (.env)" }],
    };
  }
  // Découverhe dynamique réelle (prix === 0 uniquement), TTL géré par ai-policy.
  let models = await resolveFreeModels("openrouter").catch(() => []);
  if (models.length === 0) models = [{ id: "openrouter/free", capabilities: ["chat"], verifiedFree: true, checkedAt: Date.now() }];
  const hasRealDiscovery = !(models.length === 1 && models[0].id === "openrouter/free");
  return {
    provider: "openrouter", label: LABELS.openrouter, configured: true, available: true,
    freeStatus: "FREE", summary: `🟢 Free · ${models.length} modèle(s)`,
    models: models.map((m) => ({
      provider: "openrouter", model: m.id, available: true, freeStatus: "FREE" as const,
      pricingStatus: m.id.endsWith(":free") ? "PRICE_ZERO_VERIFIED" : "FREE_ROUTER",
      capabilities: m.capabilities,
      reason: hasRealDiscovery ? "Prix réel 0 vérifié via /api/v1/models" : "Fallback global openrouter/free (découverte indisponible)",
    })),
  };
}

async function ollamaSection(): Promise<ProviderCatalogSection> {
  const configured = isConfigured("ollama");
  if (!configured) {
    return {
      provider: "ollama", label: LABELS.ollama, configured: false, available: false,
      freeStatus: "BLOCKED", summary: "🔴 Non configuré", models: [],
    };
  }
  const plan = ollamaPlan();
  const accountModels = await fetchOllamaAccountModels().catch(() => [] as { id: string; capabilities: string[] }[]);
  const available = accountModels.length > 0;
  if (!available) {
    return {
      provider: "ollama", label: LABELS.ollama, configured: true, available: false,
      freeStatus: "UNKNOWN", summary: `⚪ Plan ${plan} · aucun modèle accessible`, models: [],
    };
  }
  if (plan === "free") {
    return {
      provider: "ollama", label: LABELS.ollama, configured: true, available: true,
      freeStatus: "FREE_LIMITED", summary: "🟢 Free Plan · usage limité",
      models: accountModels.map((m) => ({
        provider: "ollama", model: m.id, available: true, freeStatus: "FREE_LIMITED" as const,
        pricingStatus: "FREE_PLAN_UNVERIFIED_PER_MODEL", capabilities: m.capabilities,
        reason: "Free plan confirmé — usage limité (quota EduSync appliqué)",
      })),
    };
  }
  // Plan indéterminable/pro : modèles ACCESSIBLES mais on ne prétend pas "unlimited free".
  return {
    provider: "ollama", label: LABELS.ollama, configured: true, available: true,
    freeStatus: "UNKNOWN",
    summary: `⚪ Plan ${plan} · modèles disponibles (tarification non prouvée gratuite)`,
    models: accountModels.map((m) => ({
      provider: "ollama", model: m.id, available: true, freeStatus: "UNKNOWN" as const,
      pricingStatus: "UNKNOWN", capabilities: m.capabilities,
      reason: "Modèle accessible au compte (/api/tags) mais prix individuel non prouvé gratuit — non routé en FREE",
    })),
  };
}

async function tokeninSection(): Promise<ProviderCatalogSection> {
  const configured = isConfigured("tokenin");
  if (!configured) {
    return {
      provider: "tokenin", label: LABELS.tokenin, configured: false, available: false,
      freeStatus: "BLOCKED" as AiFreeStatus,
      summary: "🔴 Non configuré",
      models: [],
    };
  }
  // Découverte dynamique du catalogue TOKENIN (métadonnées réelles de gratuité).
  let catalog: { id: string; capabilities: string[]; freeStatus: string }[] = [];
  let source: "api" | "fallback" = "fallback";
  try {
    const list = await tokeninListModels();
    source = tokeninCatalogSource();
    catalog = list.map((m) => ({ id: m.id, capabilities: m.capabilities, freeStatus: m.freeStatus }));
  } catch {
    // Catalogue distant indisponible -> section présentée comme indisponible.
  }
  const hasCatalog = catalog.length > 0;
  const freeCount = catalog.filter((m) => m.freeStatus === "FREE").length;
  const summary = !hasCatalog
    ? "🟡 Catalogue indisponible"
    : source === "fallback"
      ? `🟡 Catalogue indisponible · ${freeCount} gratuit(s) (secours)`
      : `🟢 ${freeCount} gratuit(s) · ${catalog.length} total`;
  return {
    provider: "tokenin", label: LABELS.tokenin, configured, available: hasCatalog,
    freeStatus: configurableFreeStatus(freeCount, hasCatalog) as AiFreeStatus,
    summary,
    // Un modèle n'est jamais déclaré gratuit sans preuve (métadonnées réelles).
    models: catalog.map((m) => ({
      provider: "tokenin" as AiProviderId, model: m.id, available: hasCatalog,
      freeStatus: (m.freeStatus === "FREE" ? "FREE" : m.freeStatus === "PAID" ? "PAID" : "UNKNOWN") as AiFreeStatus,
      pricingStatus: m.freeStatus === "FREE" ? "FREE" : m.freeStatus === "PAID" ? "PAID" : "UNKNOWN",
      capabilities: m.capabilities,
      reason: m.freeStatus === "FREE"
        ? "Modèle gratuit confirmé (tarif input/output=0)"
        : m.freeStatus === "PAID"
          ? "Modèle payant — refusé par FREE ONLY"
          : "Gratuité inconnue — à vérifier",
    })),
  };
}

/** Statut agrégé d'une section selon la présence de modèles gratuits confirmés. */
function configurableFreeStatus(freeCount: number, hasModels: boolean): "FREE" | "FREE_LIMITED" | "BLOCKED" | "UNKNOWN" {
  if (!hasModels) return "UNKNOWN";
  if (freeCount > 0) return "FREE";
  return "BLOCKED";
}

async function hfSection(): Promise<ProviderCatalogSection> {
  const configured = isConfigured("huggingface");
  const credit = hfFreeCreditState();
  if (!configured || !credit.known || credit.remaining === null || credit.remaining <= 0) {
    const reason = !configured ? "HF_TOKEN absent (.env)"
      : credit.remaining !== null && credit.remaining <= 0 ? "Crédit gratuit épuisé → HF BLOCKED"
        : "Crédit gratuit inconnu → HF BLOCKED (jamais de fallback payant)";
    const summary = !configured ? "🔴 Non configuré"
      : credit.remaining !== null && credit.remaining <= 0 ? "🔴 Bloqué · crédit gratuit épuisé"
        : "🔴 Bloqué · crédit gratuit inconnu";
    return {
      provider: "huggingface", label: LABELS.huggingface, configured, available: false,
      freeStatus: "BLOCKED", summary,
      models: [{ provider: "huggingface", model: "hf-router/inference-providers", available: false, freeStatus: "BLOCKED" as AiFreeStatus, pricingStatus: "CREDIT_BASED", capabilities: ["chat"], reason }],
    };
  }
  return {
    provider: "huggingface", label: LABELS.huggingface, configured: true, available: true,
    freeStatus: "FREE_LIMITED",
    summary: `🟡 Free Credits · reste ${credit.remaining}${credit.limit !== null ? ` / ${credit.limit}` : ""}`,
    models: [{
      provider: "huggingface", model: "hf-router/inference-providers", available: true,
      freeStatus: "FREE_LIMITED", pricingStatus: "FREE_CREDIT_PLAFONDED", capabilities: ["chat"],
      reason: `Autorisé jusqu'au plafond du crédit gratuit restant (${credit.remaining})`,
    }],
  };
}

export async function getAiProviderCatalog(forceRefresh = false): Promise<AiProviderCatalogReport> {
  if (!forceRefresh && catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.report;
  const [gemini, openrouter, ollama, huggingface, tokenin] = await Promise.all([    geminiSection(), openRouterSection(), ollamaSection(), hfSection(), tokeninSection(),
  ]);
  const byId: Record<AiProviderId, ProviderCatalogSection> = { gemini, openrouter, ollama, huggingface, tokenin };
  const report: AiProviderCatalogReport = {
    checkedAt: new Date().toISOString(),
    providers: PROVIDER_PRIORITY.map((id) => byId[id]),
    huggingFaceCredit: hfFreeCreditState(),
    ollamaPlan: ollamaPlan(),
  };
  catalogCache = { at: Date.now(), report };
  return report;
}

export function invalidateProviderCatalog() { catalogCache = null; }

/** Crédit gratuit HF : priorité aux variables .env (HF_FREE_CREDIT_*), sinon inconnu → BLOCKED. */
export function hfFreeCreditState(): { limit: number | null; remaining: number | null; known: boolean } {
  const parse = (v: string): number | null => {
    const n = Number(v.trim());
    return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const limit = parse(process.env.HF_FREE_CREDIT_LIMIT ?? "");
  const remaining = parse(process.env.HF_FREE_CREDIT_REMAINING ?? "");
  return { limit, remaining, known: remaining !== null };
}
