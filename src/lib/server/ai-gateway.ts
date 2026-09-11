/** Secure, server-only multi-provider AI gateway. */
import { geminiChat, geminiOcrGrades, geminiTranscribe, readSecret, GEMINI_VISION_MODEL, GEMINI_TEXT_MODEL } from "./ai";
import { aiRouter, AIRouterError } from "./ai-router";
import {
  AiProviderId, AiTaskType, AiCapability, AiProviderInfo, PROVIDER_PRIORITY,
  checkModelIsFree, resolveFreeModels, listProviders, invalidateModelMetadata,
  type ModelMetadata,
} from "./ai-policy";
import { ollamaChat, OllamaProviderError } from "./providers/ollama-provider";
import { tokeninChat, TokeninProviderError } from "./providers/tokenin-provider";
import { checkAndReserve, recordUsage, getLimits, ROLE_QUOTAS, type QuotaContext } from "./ai-quota-manager";

// Réexport pour compatibilité — les symboles partagés proviennent de ai-policy.ts
export type { AiProviderId, AiTaskType, AiCapability, AiProviderInfo, ModelMetadata };
export { PROVIDER_PRIORITY, checkModelIsFree, resolveFreeModels, listProviders, invalidateModelMetadata };

export type OcrStudentRef = { id: string; name: string };
export type OcrResult = Array<{ studentId: string; value: number }>;
export interface AiGatewayRequest {
  userId: string; role: string; schoolId: string | null; environment: "demo" | "production"; taskType: AiTaskType;
  messages?: Array<{ role: string; content: string }>; model?: string; useCache?: boolean; cacheKey?: string;
  capability?: AiCapability;
  ocrInput?: { imageDataUrl: string; students: OcrStudentRef[] };
  transcribeInput?: { audioBase64: string; mimeType: string };
}
export interface AiGatewayResponse {
  content: string; provider: AiProviderId; model: string; source: AiProviderId; cached: boolean;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }; finishReason?: string;
}
export class AiGatewayError extends Error {
  constructor(public readonly code: "FREE_SERVICE_UNAVAILABLE" | "QUOTA_EXCEEDED" | "RATE_LIMITED" | "PAID_OR_UNKNOWN_MODEL" | "PROVIDER_ERROR", message: string) { super(message); }
}

/** Limites par rôle — source unique : ai-quota-manager.ts (réexport pour compatibilité publique). */
export { ROLE_QUOTAS };
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const responseCache = new Map<string, { expiresAt: number; response: AiGatewayResponse }>();

type ChatMessages = NonNullable<AiGatewayRequest["messages"]>;

/** Construit le contexte de quota depuis la requête (toutes les dimensions viennent du serveur). */
function quotaContext(req: AiGatewayRequest): QuotaContext {
  return {
    userId: req.userId,
    role: req.role,
    schoolId: req.schoolId,
    environment: req.environment,
    provider: undefined,
    model: req.model,
    taskType: req.taskType,
    capability: req.capability,
  };
}

/**
 * Contrôle persistant du quota AVANT tout appel provider.
 * Lève AiGatewayError("QUOTA_EXCEEDED") si le quota est dépassé.
 */
async function checkAndRecordQuota(req: AiGatewayRequest): Promise<void> {
  const ok = await checkAndReserve(quotaContext(req));
  if (!ok) {
    await recordUsage(quotaContext(req), { status: "quota_exceeded" });
    throw new AiGatewayError("QUOTA_EXCEEDED", "Quota IA gratuit atteint pour cette periode.");
  }
}

function cacheScope(req: AiGatewayRequest) { return `${req.environment}:${req.schoolId ?? "global"}:${req.role}:${req.userId}:${req.cacheKey ?? ""}`; }

async function openRouterChat(messages: ChatMessages, model: string): Promise<AiGatewayResponse> {
  if (!checkModelIsFree("openrouter", model).allowed) throw new AiGatewayError("PAID_OR_UNKNOWN_MODEL", "Le modèle demandé n'est pas confirmé gratuit.");
  const res = await fetch(OPENROUTER_URL, { method: "POST", signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${readSecret(["OPENROUTER_API_KEY"])}`, "Content-Type": "application/json", "X-Title": "EduSync Pro" }, body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 4000 }) });
  if (res.status === 429) throw new AiGatewayError("RATE_LIMITED", "Limite OpenRouter gratuite atteinte.");
  if (res.status === 401 || res.status === 403 || !res.ok) throw new AiGatewayError("PROVIDER_ERROR", "Le fournisseur OpenRouter est temporairement indisponible.");
  const data = await res.json() as { model?: string; choices?: Array<{ message?: { content?: string }; finish_reason?: string }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AiGatewayError("PROVIDER_ERROR", "Réponse OpenRouter vide.");
  return { content, provider: "openrouter", source: "openrouter", model: data.model ?? model, cached: false, finishReason: data.choices?.[0]?.finish_reason, usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens } };
}
async function geminiFreeChat(messages: ChatMessages, model: string): Promise<AiGatewayResponse> {
  if (!checkModelIsFree("gemini", model).allowed) throw new AiGatewayError("PAID_OR_UNKNOWN_MODEL", "Le modèle Gemini demandé n'est pas confirmé gratuit.");
  try { return { content: await geminiChat(messages, { model, temperature: 0.4, maxTokens: 4000 }), provider: "gemini", source: "gemini", model, cached: false }; }
  catch { throw new AiGatewayError("PROVIDER_ERROR", "Le fournisseur Gemini est temporairement indisponible."); }
}
/**
 * Adaptateur Ollama Cloud — exécuté DANS le pipeline gateway (quota/cache/audit/FREE-ONLY appliqués automatiquement).
 * Le provider est additif : sans preuve FREE_VERIFIED (checkModelIsFree ci-dessous) le modèle est
 * bloqué avant tout appel réseau. Aucune clé/secrète n'est jamais loggée ni renvoyée.
 */
async function ollamaChatAdapter(messages: ChatMessages, model: string): Promise<AiGatewayResponse> {
  if (!checkModelIsFree("ollama", model).allowed) throw new AiGatewayError("PAID_OR_UNKNOWN_MODEL", "Le modèle Ollama demandé n'est pas confirmé gratuit.");
  try {
    const content = await ollamaChat(messages, model, { temperature: 0.4 });
    return { content, provider: "ollama", source: "ollama", model, cached: false };
  } catch (err) {
    if (err instanceof OllamaProviderError) {
      const mapped: Record<string, "RATE_LIMITED" | "PAID_OR_UNKNOWN_MODEL" | "PROVIDER_ERROR"> = { RATE_LIMITED: "RATE_LIMITED", MODEL_NOT_FOUND: "PAID_OR_UNKNOWN_MODEL" };
      throw new AiGatewayError(mapped[err.code] ?? "PROVIDER_ERROR", err.message);
    }
    throw new AiGatewayError("PROVIDER_ERROR", "Le fournisseur Ollama est temporairement indisponible.");
  }
}



/**
 * Adaptateur TOKEN FREE IA (tokenin) — exécuté DANS le pipeline gateway
 * (quota/cache/audit/FREE-ONLY appliqués automatiquement).
 * Aucune clé/secrète n'est jamais loggée ni renvoyée.
 */
async function tokeninChatAdapter(messages: ChatMessages, model: string): Promise<AiGatewayResponse> {
  if (!checkModelIsFree("tokenin", model).allowed) throw new AiGatewayError("PAID_OR_UNKNOWN_MODEL", "Le modèle TOKEN FREE IA demandé n'est pas confirmé gratuit.");
  try {
    const content = await tokeninChat(messages, model, { temperature: 0.4 });
    return { content, provider: "tokenin", source: "tokenin", model, cached: false };
  } catch (err) {
    if (err instanceof TokeninProviderError) {
      const mapped: Record<string, "RATE_LIMITED" | "PAID_OR_UNKNOWN_MODEL" | "PROVIDER_ERROR"> = { RATE_LIMITED: "RATE_LIMITED", MODEL_NOT_FOUND: "PAID_OR_UNKNOWN_MODEL" };
      throw new AiGatewayError(mapped[err.code] ?? "PROVIDER_ERROR", err.message);
    }
    throw new AiGatewayError("PROVIDER_ERROR", "Le fournisseur TOKEN FREE IA est temporairement indisponible.");
  }
}
/** OCR adapter -- delegates to geminiOcrGrades (vision). HF stays cost-guarded (UNKNOWN_PRICING). */
async function geminiOcrAdapter(input: NonNullable<AiGatewayRequest["ocrInput"]>): Promise<AiGatewayResponse> {
  if (!checkModelIsFree("gemini", GEMINI_VISION_MODEL).allowed) throw new AiGatewayError("PAID_OR_UNKNOWN_MODEL", "Le modele Gemini vision n'est pas confirme gratuit.");
  try {
    const grades = await geminiOcrGrades(input);
    return { content: JSON.stringify(grades), provider: "gemini", source: "gemini", model: GEMINI_VISION_MODEL, cached: false };
  } catch (err) {
    throw new AiGatewayError("PROVIDER_ERROR", `Gemini OCR indisponible : ${(err as Error).message.slice(0, 200)}`);
  }
}

/** Transcribe adapter -- delegates to geminiTranscribe (audio). HF stays cost-guarded (UNKNOWN_PRICING). */
async function geminiTranscribeAdapter(input: NonNullable<AiGatewayRequest["transcribeInput"]>): Promise<AiGatewayResponse> {
  if (!checkModelIsFree("gemini", GEMINI_TEXT_MODEL).allowed) throw new AiGatewayError("PAID_OR_UNKNOWN_MODEL", "Le modele Gemini TTS n'est pas confirme gratuit.");
  try {
    const buffer = Buffer.from(input.audioBase64, "base64");
    const text = await geminiTranscribe(buffer, input.mimeType);
    return { content: text, provider: "gemini", source: "gemini", model: GEMINI_TEXT_MODEL, cached: false };
  } catch (err) {
    throw new AiGatewayError("PROVIDER_ERROR", `Gemini transcription indisponible : ${(err as Error).message.slice(0, 200)}`);
  }
}

/** Convertit une erreur du Router en erreur Gateway normalisée. */
function normalizeRouterError(err: unknown): never {
  if (err instanceof AIRouterError) {
    throw new AiGatewayError(
      err.code === "PAID_OR_UNKNOWN_MODEL" ? "PAID_OR_UNKNOWN_MODEL" : "FREE_SERVICE_UNAVAILABLE",
      err.message,
    );
  }
  throw err;
}

/** OCR capability -- routes through gateway for FREE ONLY / quota / audit control. */
async function aiGatewayOcr(req: AiGatewayRequest): Promise<AiGatewayResponse> {
  if (!req.ocrInput) throw new AiGatewayError("PROVIDER_ERROR", "Input OCR manquant.");
  await checkAndRecordQuota(req);
  let decision;
  try {
    decision = await aiRouter({
      taskType: req.taskType,
      capability: "ocr",
      requestedModel: req.model,
      userContext: { userId: req.userId, role: req.role, schoolId: req.schoolId },
      environment: req.environment,
    });
  } catch (err) {
    normalizeRouterError(err);
  }
  if (decision.provider === "gemini") {
    const response = await geminiOcrAdapter(req.ocrInput);
    await recordUsage({ ...quotaContext(req), provider: "gemini", model: GEMINI_VISION_MODEL }, { status: "success" });
    return response;
  }
  throw new AiGatewayError("FREE_SERVICE_UNAVAILABLE", "Aucun provider gratuit compatible OCR disponible.");
}

/** Transcribe capability -- routes through gateway for FREE ONLY / quota / audit control. */
async function aiGatewayTranscribe(req: AiGatewayRequest): Promise<AiGatewayResponse> {
  if (!req.transcribeInput) throw new AiGatewayError("PROVIDER_ERROR", "Input transcription manquant.");
  await checkAndRecordQuota(req);
  let decision;
  try {
    decision = await aiRouter({
      taskType: req.taskType,
      capability: "transcribe",
      requestedModel: req.model,
      userContext: { userId: req.userId, role: req.role, schoolId: req.schoolId },
      environment: req.environment,
    });
  } catch (err) {
    normalizeRouterError(err);
  }
  if (decision.provider === "gemini") {
    const response = await geminiTranscribeAdapter(req.transcribeInput);
    await recordUsage({ ...quotaContext(req), provider: "gemini", model: GEMINI_TEXT_MODEL }, { status: "success" });
    return response;
  }
  throw new AiGatewayError("FREE_SERVICE_UNAVAILABLE", "Aucun provider gratuit compatible transcription disponible.");
}

export async function aiGateway(req: AiGatewayRequest): Promise<AiGatewayResponse> {
  const cap = req.capability ?? "chat";
  if (cap === "ocr") return aiGatewayOcr(req);
  if (cap === "transcribe") return aiGatewayTranscribe(req);
  if (!req.messages || !req.messages.length || req.messages.some((message) => !message.content.trim())) throw new AiGatewayError("PROVIDER_ERROR", "La requete IA est invalide.");
  const scopedKey = req.useCache && req.cacheKey ? cacheScope(req) : null;
  const cached = scopedKey ? responseCache.get(scopedKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) return { ...cached.response, cached: true };
  await checkAndRecordQuota(req);
  let decision;
  try {
    decision = await aiRouter({
      taskType: req.taskType,
      capability: "chat",
      requestedModel: req.model,
      userContext: { userId: req.userId, role: req.role, schoolId: req.schoolId },
      environment: req.environment,
    });
  } catch (err) {
    normalizeRouterError(err);
  }
  for (const step of decision.fallbackChain) {
    try {
            const response =
        step.provider === "gemini" ? await geminiFreeChat(req.messages!, step.model)
        : step.provider === "openrouter" ? await openRouterChat(req.messages!, step.model)
        : step.provider === "ollama" ? await ollamaChatAdapter(req.messages!, step.model)
        : step.provider === "tokenin" ? await tokeninChatAdapter(req.messages!, step.model)
        : null;
      if (response) {
        if (scopedKey) responseCache.set(scopedKey, { expiresAt: Date.now() + 300_000, response });
        await recordUsage(
          { ...quotaContext(req), provider: step.provider, model: step.model },
          {
            status: "success",
            inputTokens: response.usage?.inputTokens,
            outputTokens: response.usage?.outputTokens,
            totalTokens: response.usage?.totalTokens,
          },
        );
        return response;
      }
    } catch { /* essayer etape suivante */ }
  }
  throw new AiGatewayError("FREE_SERVICE_UNAVAILABLE", "Le service IA gratuit correspondant a cette tache est actuellement indisponible.");
}

