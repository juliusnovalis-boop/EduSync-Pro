/**
 * EDUSYNC PRO - Provider TOKEN FREE IA (tokenin.my.id).
 * Compatible OpenAI API - serveur uniquement.
 * FREE ONLY s applique au MODELE, pas au provider.
 */
import { readSecret } from "../ai";

const DEFAULT_BASE_URL = "https://tokenin.my.id";
const CHAT_TIMEOUT_MS = 60000;
const MODELS_TIMEOUT_MS = 20000;

export type TokeninErrorCode =
  | "NO_API_KEY"
  | "AUTH_FAILED"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "EMPTY_RESPONSE"
  | "PROVIDER_ERROR";

export class TokeninProviderError extends Error {
  constructor(public readonly code: TokeninErrorCode, message: string) {
    super(message);
    this.name = "TokeninProviderError";
  }
}

export function tokeninApiKey(): string {
  return readSecret(["TOKEN_API_KEY"]);
}

export function isTokeninConfigured(): boolean {
  return tokeninApiKey().length > 0;
}

function baseUrl(): string {
  const raw = process.env.TOKENIN_BASE_URL?.trim().replace(/\/+$/, "");
  return raw || DEFAULT_BASE_URL;
}

type ChatMessage = { role: string; content: unknown };

function safeLog(scope: string, detail: string) {
  console.log("[tokenin] " + scope + ": " + detail);
}

async function tokeninFetch(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const key = tokeninApiKey();
  if (!key) throw new TokeninProviderError("NO_API_KEY", "TOKEN FREE IA n est pas configure sur ce serveur.");

  let res: Response;
  try {
    res = await fetch(baseUrl() + path, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const name = (err as Error)?.name ?? "";
    if (name === "TimeoutError" || name === "AbortError") {
      safeLog("chat timeout", String(timeoutMs) + "ms");
      throw new TokeninProviderError("TIMEOUT", "Le modele TOKEN FREE IA a mis trop de temps a repondre.");
    }
    safeLog("network error", name || "unknown");
    throw new TokeninProviderError("NETWORK_ERROR", "Reseau indisponible vers TOKEN FREE IA.");
  }

  if (res.status === 401 || res.status === 403) {
    safeLog("auth failed", String(res.status));
    throw new TokeninProviderError("AUTH_FAILED", "Authentification TOKEN FREE IA refusee.");
  }
  if (res.status === 404) {
    throw new TokeninProviderError("MODEL_NOT_FOUND", "Ce modele n est pas disponible sur TOKEN FREE IA.");
  }
  if (res.status === 429) {
    safeLog("rate limited", "429");
    throw new TokeninProviderError("RATE_LIMITED", "Limite d utilisation TOKEN FREE IA atteinte.");
  }
  if (!res.ok) {
    safeLog("provider error", String(res.status));
    throw new TokeninProviderError("PROVIDER_ERROR", "Erreur du service TOKEN FREE IA.");
  }
  return res;
}

export async function tokeninChat(
  messages: ChatMessage[],
  model: string,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  if (!model?.trim()) throw new TokeninProviderError("MODEL_NOT_FOUND", "Modele requis.");

  const res = await tokeninFetch(
    "/v1/chat/completions",
    {
      model,
      messages,
      stream: false,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
    },
    CHAT_TIMEOUT_MS,
  );

  let data: { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string } };
  try {
    data = await res.json();
  } catch {
    safeLog("invalid json", model);
    throw new TokeninProviderError("PROVIDER_ERROR", "Reponse illisible de TOKEN FREE IA.");
  }

  if (data.error) {
    safeLog("api error", data.error.message ?? "unknown");
    throw new TokeninProviderError("PROVIDER_ERROR", data.error.message ?? "Erreur TOKEN FREE IA.");
  }

  const choice = data.choices?.[0];
  const content = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
  if (!content) {
    safeLog("empty response", model);
    throw new TokeninProviderError("EMPTY_RESPONSE", "Le modele TOKEN FREE IA a renvoye une reponse vide.");
  }
  safeLog("chat ok", model);
  return content;
}

export type TokeninFreeStatus = "FREE" | "PAID" | "UNKNOWN";

/** Statut de gratuité réel d'un modèle, déterminé à partir des métadonnées
 *  du fournisseur (input=0 / output=0 / cache=0) ou du suffixe officiel `-free`. */
export interface TokeninModel {
  id: string;
  capabilities: string[];
  freeStatus: TokeninFreeStatus;
}

/** Détermine le statut de gratuité d'un modèle depuis ses métadonnées.
 *  FREE si suffixe `-free` OU tarifs input/output/cache tous à zéro.
 *  PAID si un tarif est strictement positif. Sinon UNKNOWN. */
export function classifyTokeninFreeStatus(id: string, pricingRaw?: Array<{ id?: unknown; input?: unknown; output?: unknown; cache?: unknown }>): TokeninFreeStatus {
  if (id.toLowerCase().endsWith("-free")) return "FREE";
  const model = (pricingRaw ?? []).find((p) => String(p.id ?? "") === id);
  if (model) {
    const keys: Array<"input" | "output" | "cache"> = ["input", "output", "cache"];
    const present = keys.filter((k) => model[k] !== undefined);
    if (present.length > 0) {
      const anyPositive = present.some((k) => {
        const num = Number(model[k]);
        return Number.isFinite(num) && num > 0;
      });
      if (!anyPositive) return "FREE";
      return "PAID";
    }
  }
  return "UNKNOWN";
}

interface ModelsCache {
  at: number;
  models: TokeninModel[];
  /** 'api' si le catalogue dynamique a répondu, sinon 'fallback'. */
  source: "api" | "fallback";
}

let modelsCacheData: ModelsCache | null = null;
const MODELS_TTL_MS = 15 * 60000;

/** Catalogue des modeles gratuits TOKENIN (toujours disponibles en fallback). */
const TOKENIN_KNOWN_FREE_MODELS: TokeninModel[] = [
  { id: "myt/gpt-5.6-sol-free", capabilities: ["chat"], freeStatus: "FREE" },
  { id: "myt/claude-opus-4-8-free", capabilities: ["chat"], freeStatus: "FREE" },
  { id: "myt/glm-5.3-free", capabilities: ["chat"], freeStatus: "FREE" },
  { id: "myt/MiniMax-M3-free", capabilities: ["chat"], freeStatus: "FREE" },
  { id: "myt/qwen3.8-max-free", capabilities: ["chat"], freeStatus: "FREE" },
  { id: "myt/deepseek-v3-free", capabilities: ["chat"], freeStatus: "FREE" },
  { id: "myt/gpt-4o-mini-free", capabilities: ["chat"], freeStatus: "FREE" },
  { id: "myt/llama-4-scout-free", capabilities: ["chat"], freeStatus: "FREE" },
];

/**
 * Recupere la liste des modeles TOKENIN.
 * Strategie :
 *  1. Tentative via GET /v1/models.
 *  2. Si echec (reseau / timeout / erreur) -> retourne le catalogue gratuit hardcode.
 *
 * FREE ONLY s applique au MODELE selectionne, pas au provider.
 * Un provider peut avoir des modeles gratuits ET payants.
 */
export async function tokeninListModels(): Promise<TokeninModel[]> {
  if (!isTokeninConfigured()) return [];
  if (modelsCacheData && Date.now() - modelsCacheData.at < MODELS_TTL_MS) {
    return modelsCacheData.models;
  }

  let fetchedModels: TokeninModel[] = [];
  let source: "api" | "fallback" = "fallback";

  try {
    const res = await fetch(baseUrl() + "/v1/models", {
      method: "GET",
      headers: { Authorization: "Bearer " + tokeninApiKey() },
      signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
    });

    if (res.ok) {
      const data: { data?: Array<{ id?: string; object?: string } & Record<string, unknown>> } = await res.json().catch(() => ({}));
      const raw = (data.data ?? []).filter((m) => m.object === "model" && m.id);
      fetchedModels = raw.map((m) => ({
        id: m.id as string,
        capabilities: ["chat"] as string[],
        freeStatus: classifyTokeninFreeStatus(m.id as string, raw),
      }));
      source = "api";
    }
  } catch {
    // reseau / timeout / parse error -> fallback vers le catalogue gratuit hardcode
  }

  // Si l API n a rien retourne, utiliser le catalogue gratuit hardcode
  const models = fetchedModels.length > 0 ? fetchedModels : TOKENIN_KNOWN_FREE_MODELS;
  if (source === "fallback") {
    safeLog("models list", "API indisponible — catalogue gratuit hardcode utilise (" + models.length + " modeles)");
  } else {
    const freeCount = models.filter((m) => m.freeStatus === "FREE").length;
    safeLog("models list", "Catalogue dynamique: total=" + models.length + " free=" + freeCount);
  }

  modelsCacheData = { at: Date.now(), models, source };
  return models;
}

/** Vrai si le catalogue dynamique TOKENIN a réellement répondu (vs fallback). */
export function tokeninCatalogSource(): "api" | "fallback" {
  return modelsCacheData?.source ?? "fallback";
}

/** Vrai si un modèle est confirmé gratuit par les métadonnées TOKENIN actuellement
 *  en cache (suffixe `-free` ou tarifs input/output/cache = 0).
 *  Sert de garde-fou FREE ONLY cohérent avec `classifyTokeninFreeStatus`. */
export function tokeninIsFreeModel(model: string): boolean {
  const id = model.trim().toLowerCase();
  if (id.endsWith("-free")) return true;
  const cached = modelsCacheData?.models ?? [];
  const entry = cached.find((m) => m.id.toLowerCase() === id);
  return entry?.freeStatus === "FREE";
}

export function invalidateTokeninModelsCache() {
  modelsCacheData = null;
}
