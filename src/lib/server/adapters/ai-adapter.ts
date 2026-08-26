/**
 * EDUSYNC AI SERVICE ADAPTER — Pont entre le Core IA et le pipeline centralisé.
 *
 * Le Core (src/core/services/ai) ne doit jamais connaître aiGateway, aiPolicy
 * ou les clés API. Cet adapter transforme les appels Core en AiGatewayRequest
 * et délègue l'exécution au pipeline central :
 *
 *   Core → AIServiceAdapter → aiGateway → aiRouter → aiPolicy → Provider
 *
 * Responsabilités :
 * - transformer un appel Core en AiGatewayRequest ;
 * - appeler aiGateway ;
 * - convertir la réponse Gateway vers le contrat Core ;
 * - ne jamais appeler directement un provider ;
 * - ne jamais lire les secrets ;
 * - ne jamais choisir un modèle ;
 * - ne jamais appliquer sa propre politique FREE ONLY ;
 * - ne jamais appliquer ses propres quotas.
 */
import { aiGateway, AiGatewayError, type AiGatewayResponse } from "../ai-gateway";
import { cleanAiOutput } from "../ai";

/** Contexte IA injecté (auth + environnement) — jamais créé dans le Core. */
export interface AiAdapterContext {
  userId: string;
  role: string;
  schoolId: string | null;
  environment: "demo" | "production";
}

/** Contrat des appels Core supportés par l'adapter. */
export interface AiAdapterChatInput {
  messages: Array<{ role: string; content: string }>;
  model?: string;
}

export interface AiAdapterOcrInput {
  imageDataUrl: string;
  students: Array<{ id: string; name: string }>;
}

export interface AiAdapterTranscribeInput {
  audioBase64: string;
  mimeType: string;
}

export interface AiAdapterAnalysisResult {
  report: string;
  source: string;
  model: string;
}

export interface AiAdapterOcrResult {
  studentId: string;
  value: number;
}

/**
 * AIServiceAdapter — délègue TOUS les appels IA au gateway centralisé.
 *
 * Le contexte (userId, role, schoolId, environment) est injecté via
 * setContext() ou le constructeur. Sans contexte, l'adapter refuse
 * d'exécuter (pas de bypass possible).
 */
export class AIServiceAdapter {
  private ctx: AiAdapterContext | null = null;

  constructor(ctx?: AiAdapterContext) {
    this.ctx = ctx ?? null;
  }

  /** Injecte ou remplace le contexte IA (auth + environnement). */
  setContext(ctx: AiAdapterContext): this {
    this.ctx = ctx;
    return this;
  }

  hasContext(): boolean {
    return this.ctx !== null;
  }

  private requireContext(): AiAdapterContext {
    if (!this.ctx) {
      throw new Error(
        "AIServiceAdapter : contexte IA manquant. Injectez userId/role/schoolId/environment avant tout appel.",
      );
    }
    return this.ctx;
  }

  /** Analyse pédagogique — délègue au gateway (capability chat, taskType analysis). */
  async analyze(
    params: {
      term: string;
      termLabel: string;
      focus?: string;
      dataContext: string;
      systemPrompt: string;
    },
  ): Promise<AiAdapterAnalysisResult> {
    const ctx = this.requireContext();
    const userPrompt = [
      params.dataContext,
      "",
      params.focus ? `AXE D'ANALYSE DEMANDÉ : ${params.focus}` : "Analyse globale de la période.",
      "",
      "Rédige le rapport maintenant.",
    ].join("\n");

    const response = await aiGateway({
      userId: ctx.userId,
      role: ctx.role,
      schoolId: ctx.schoolId,
      environment: ctx.environment,
      taskType: "analysis",
      capability: "chat",
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      useCache: false,
    });

    return {
      report: cleanAiOutput(response.content),
      source: response.source,
      model: response.model,
    };
  }

  /** Chat générique — délègue au gateway (capability chat). */
  async chat(input: AiAdapterChatInput): Promise<AiGatewayResponse> {
    const ctx = this.requireContext();
    return aiGateway({
      userId: ctx.userId,
      role: ctx.role,
      schoolId: ctx.schoolId,
      environment: ctx.environment,
      taskType: "standard",
      capability: "chat",
      messages: input.messages,
      model: input.model,
      useCache: false,
    });
  }

  /** OCR — délègue au gateway (capability ocr). */
  async extractGrades(input: AiAdapterOcrInput): Promise<AiAdapterOcrResult[]> {
    const ctx = this.requireContext();
    const response = await aiGateway({
      userId: ctx.userId,
      role: ctx.role,
      schoolId: ctx.schoolId,
      environment: ctx.environment,
      taskType: "vision",
      capability: "ocr",
      ocrInput: {
        imageDataUrl: input.imageDataUrl,
        students: input.students,
      },
    });
    try {
      return JSON.parse(response.content) as AiAdapterOcrResult[];
    } catch {
      throw new AiGatewayError("PROVIDER_ERROR", "Réponse OCR invalide du fournisseur.");
    }
  }

  /** Transcription — délègue au gateway (capability transcribe). */
  async transcribe(input: AiAdapterTranscribeInput): Promise<string> {
    const ctx = this.requireContext();
    const response = await aiGateway({
      userId: ctx.userId,
      role: ctx.role,
      schoolId: ctx.schoolId,
      environment: ctx.environment,
      taskType: "audio",
      capability: "transcribe",
      transcribeInput: {
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
      },
    });
    return response.content;
  }
}