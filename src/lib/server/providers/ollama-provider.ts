/**
 * EDUSYNC PRO — Provider Ollama Cloud (serveur uniquement).
 *
 * Communication exclusive avec https://ollama.com/api/chat (docs.ollama.com/cloud).
 * - La clé est lue UNIQUEMENT côté serveur depuis OLLAMA_API_KEY (jamais codée,
 *   jamais loggée, jamais renvoyée au frontend).
 * - Réponses normalisées pour l'AI Router / ai-gateway.
 * - Erreurs mappées : NO_API_KEY · AUTH_FAILED · MODEL_NOT_FOUND · RATE_LIMITED ·
 *   TIMEOUT · NETWORK_ERROR · EMPTY_RESPONSE · PROVIDER_ERROR.
 */
import { readSecret } from "../ai";

const DEFAULT_BASE_URL = "https://ollama.com";
const CHAT_TIMEOUT_MS = 60_000;
const TAGS_TIMEOUT_MS = 10_000;

/** Clé API Ollama — serveur uniquement, jamais exposée ni loggée. */
export function ollamaApiKey(): string {
  return readSecret(["OLLAMA_API_KEY"]);
}

/** Base URL Ollama Cloud (surchargable, défaut https://ollama.com). */
function baseUrl(): string {
  const raw = process.env.OLLAMA_BASE_URL?.trim().replace(/\/+$/, "");
  return raw || DEFAULT_BASE_URL;
}

export function isOllamaConfigured(): boolean {
  return ollamaApiKey().length > 0;
}

export type OllamaErrorCode =
  | "NO_API_KEY"
  | "AUTH_FAILED"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "EMPTY_RESPONSE"
  | "PROVIDER_ERROR";

/** Erreur normalisée — le message ne contient jamais de secret. */
export class OllamaProviderError extends Error {
  constructor(public readonly code: OllamaErrorCode, message: string) {
    super(message);
    this.name = "OllamaProviderError";
  }
}

type ChatMessage = { role: string; content: unknown };

/** Journalisation sûre : statut/code/modèle uniquement — jamais la clé ni les headers. */
function safeLog(scope: string, detail: string) {
  console.log(`[ollama] ${scope}: ${detail}`);
}

async function ollamaFetch(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const key = ollamaApiKey();
  if (!key) throw new OllamaProviderError("NO_API_KEY", "Ollama Cloud n'est pas configuré sur ce serveur.");

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const name = (err as Error)?.name ?? "";
    if (name === "TimeoutError" || name === "AbortError") {
      safeLog("chat timeout", `${timeoutMs}ms`);
      throw new OllamaProviderError("TIMEOUT", "Le modèle Ollama a mis trop de temps à répondre.");
    }
    safeLog("network error", name || "unknown");
    throw new OllamaProviderError("NETWORK_ERROR", "Réseau indisponible vers Ollama Cloud.");
  }

  if (res.status === 401 || res.status === 403) {
    safeLog("auth failed", String(res.status));
    throw new OllamaProviderError("AUTH_FAILED", "Authentification Ollama refusée.");
  }
  if (res.status === 404) {
    throw new OllamaProviderError("MODEL_NOT_FOUND", "Ce modèle n'est pas disponible sur Ollama Cloud.");
  }
  if (res.status === 429) {
    safeLog("rate limited", "429");
    throw new OllamaProviderError("RATE_LIMITED", "Limite d'utilisation Ollama atteinte.");
  }
  if (!res.ok) {
    safeLog("provider error", String(res.status));
    throw new OllamaProviderError("PROVIDER_ERROR", "Erreur du service Ollama Cloud.");
  }
  return res;
}

/**
 * Chat non-streamé via https://ollama.com/api/chat.
 * Renvoie uniquement le contenu textuel de la réponse.
 */
export async function ollamaChat(
  messages: ChatMessage[],
  model: string,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  if (!model?.trim()) throw new OllamaProviderError("MODEL_NOT_FOUND", "Modèle requis.");

  const res = await ollamaFetch(
    "/api/chat",
    {
      model,
      messages,
      stream: false,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.maxTokens !== undefined ? { options: { num_predict: options.maxTokens } } : {}),
    },
    CHAT_TIMEOUT_MS,
  );

  let data: { message?: { content?: unknown }; error?: string };
  try {
    data = await res.json();
  } catch {
    safeLog("invalid json", model);
    throw new OllamaProviderError("PROVIDER_ERROR", "Réponse illisible d'Ollama Cloud.");
  }

  const content = typeof data.message?.content === "string" ? data.message.content.trim() : "";
  if (!content) {
    safeLog("empty response", model);
    throw new OllamaProviderError("EMPTY_RESPONSE", "Le modèle Ollama a renvoyé une réponse vide.");
  }
  safeLog("chat ok", model);
  return content;
}

/**
 * Liste les modèles réellement disponibles sur le compte Ollama (GET /api/tags).
 * Utilisé pour l'administration/validation — jamais exposé au client.
 */
export async function ollamaListModels(): Promise<string[]> {
  const key = ollamaApiKey();
  if (!key) throw new OllamaProviderError("NO_API_KEY", "Ollama Cloud n'est pas configuré sur ce serveur.");
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/api/tags`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TAGS_TIMEOUT_MS),
    });
  } catch (err) {
    const name = (err as Error)?.name ?? "";
    if (name === "TimeoutError" || name === "AbortError") throw new OllamaProviderError("TIMEOUT", "Délai dépassé.");
    throw new OllamaProviderError("NETWORK_ERROR", "Réseau indisponible vers Ollama Cloud.");
  }
  if (!res.ok) throw new OllamaProviderError(res.status === 401 ? "AUTH_FAILED" : "PROVIDER_ERROR", "Liste des modèles indisponible.");
  const data = (await res.json()) as { models?: Array<{ name?: string }> };
  return (data.models ?? []).map((m) => m.name ?? "").filter(Boolean);
}
