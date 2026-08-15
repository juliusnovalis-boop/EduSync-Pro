import { generateAnalysis } from "@/lib/server/ai";
import type { IModule, ModuleContext } from "../../interfaces";
import { CAPABILITIES } from "../../kernel/capabilities";
import type { EventBus } from "../../kernel/event-bus";
import { AIProviderRegistry } from "./registry";
import type { AnalysisParams, IAIProvider, OcrInput, OcrResult } from "./ai-provider";

/**
 * Service IA = façade unique pour les capacités liées à l'IA.
 * - Résout le provider actif via le registry (1 source de vérité, plus de if/else).
 * - Émet des événements Core (ai.analysis.*) pour un traitement découplé.
 * - Fournit une dégradation gracieuse (analyse locale) en cas d'échec provider.
 *
 * P1 : analyze() délègue à generateAnalysis (compatibilité, ai.ts intact).
 * P2 : les routes /api/ai, /api/ocr, /api/transcribe appelleront ce service.
 */
export class AIService implements IModule {
  readonly id = "ai";
  readonly name = "Analyse & IA";
  readonly version = "1.0.0";
  readonly capabilities = [CAPABILITIES.TEXT_ANALYZE, CAPABILITIES.OCR_EXTRACT, CAPABILITIES.AUDIO_TRANSCRIBE];
  enabled = true;

  private bus: EventBus | null = null;
  readonly providers = new AIProviderRegistry();

  initialize(ctx: ModuleContext) {
    this.bus = ctx.eventBus;
  }

  registerProvider(provider: IAIProvider): this {
    this.providers.register(provider);
    return this;
  }

  activeProvider() {
    return this.providers.resolve();
  }

  label(): string {
    return this.activeProvider()?.label ?? "Moteur local";
  }

  aiEnabled(): boolean {
    return this.activeProvider()?.id !== "local";
  }

  async analyze(params: AnalysisParams) {
    this.bus?.emit("ai.analysis.started", { term: params.term });
    try {
      const result = await generateAnalysis(params); // P1 : orchestration existante (Gemini→HF→local)
      this.bus?.emit("ai.analysis.completed", { source: result.source, model: result.model });
      return result;
    } catch (error) {
      this.bus?.emit("ai.analysis.failed", { error: (error as Error).message });
      throw error;
    }
  }

  /** OCR : premier provider visuel disponible (remplace le if/else de /api/ocr). */
  async extractGrades(input: OcrInput): Promise<OcrResult> {
    const provider = this.providers.resolveByCapability("vision");
    if (!provider?.extractGrades) {
      throw new Error("OCR indisponible : configurez GEMINI_API_KEY ou HF_TOKEN.");
    }
    return provider.extractGrades(input);
  }

  /** Transcription : premier provider audio disponible (remplace le if/else de /api/transcribe). */
  async transcribe(buffer: Buffer, mimeType: string): Promise<string> {
    const provider = this.providers.resolveByCapability("audio");
    if (!provider?.transcribe) {
      throw new Error("Transcription indisponible : configurez GEMINI_API_KEY ou HF_TOKEN.");
    }
    return provider.transcribe(buffer, mimeType);
  }
}
