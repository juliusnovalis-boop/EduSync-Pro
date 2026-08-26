import { AIServiceAdapter, type AiAdapterContext } from "@/lib/server/adapters/ai-adapter";
import { buildDataContext, buildSystemPrompt } from "@/lib/server/ai";
import type { IModule, ModuleContext } from "../../interfaces";
import { CAPABILITIES } from "../../kernel/capabilities";
import type { EventBus } from "../../kernel/event-bus";
import { AIProviderRegistry } from "./registry";
import type { AnalysisParams, IAIProvider, OcrInput, OcrResult } from "./ai-provider";

/**
 * Service IA = façade unique pour les capacités liées à l'IA.
 * - Résout le provider actif via le registry (1 source de vérité, plus de if/else).
 * - Émet des événements Core (ai.analysis.*) pour un traitement découplé.
 *
 * ⚠ Phase 5B.1 — Fermeture définitive des bypass :
 * Les méthodes analyze() / extractGrades() / transcribe() ne peuvent PLUS
 * exécuter un provider distant lorsqu'aucun AIServiceAdapter n'est disponible.
 *
 * Architecture obligatoire (aucun chemin alternatif) :
 *   Core (AIService) → AIServiceAdapter → aiGateway → aiRouter → aiPolicy → Provider
 *
 * Sans adaptateur (contexte Gateway manquant) : erreur contrôlée AiContextRequiredError.
 * Aucun fallback automatique vers generateAnalysis()/geminiChat()/hfChat()/…
 * n'est plus autorisé ici.
 */
export class AiContextRequiredError extends Error {
  constructor() {
    super("AI context required — AIServiceAdapter (userId, role, schoolId, environment) obligatoire avant tout appel distant IA.");
    this.name = "AiContextRequiredError";
  }
}

export class AIService implements IModule {
  readonly id = "ai";
  readonly name = "Analyse & IA";
  readonly version = "1.0.0";
  readonly capabilities = [CAPABILITIES.TEXT_ANALYZE, CAPABILITIES.OCR_EXTRACT, CAPABILITIES.AUDIO_TRANSCRIBE];
  enabled = true;

  private bus: EventBus | null = null;
  readonly providers = new AIProviderRegistry();
  private adapter: AIServiceAdapter | null = null;

  initialize(ctx: ModuleContext) {
    this.bus = ctx.eventBus;
    // Récupère un adapter préalablement enregistré (DI) s'il existe.
    const registered = (ctx as ModuleContext & { aiAdapter?: AIServiceAdapter }).aiAdapter;
    if (registered) this.adapter = registered;
  }

  /** Injecte l'adapter centralisé (via DI ou composition). */
  useAdapter(adapter: AIServiceAdapter): this {
    this.adapter = adapter;
    return this;
  }

  /** Configure le contexte IA sur l'adapter (auth + environnement). */
  setAdapterContext(ctx: AiAdapterContext): this {
    if (this.adapter) this.adapter.setContext(ctx);
    return this;
  }

  hasAdapter(): boolean {
    return this.adapter !== null && this.adapter.hasContext();
  }

  /**
   * L'adapter est OBLIGATOIRE pour toute exécution distante.
   * Refus systématique si absent ou sans contexte (aucun environment implicite).
   */
  private requireAdapter(): AIServiceAdapter {
    const adapter = this.adapter;
    if (!adapter || !adapter.hasContext()) {
      throw new AiContextRequiredError();
    }
    return adapter;
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
      const adapter = this.requireAdapter();
      const dataContext = buildDataContext(params);
      const systemPrompt = buildSystemPrompt();
      const result = await adapter.analyze({
        term: params.term,
        termLabel: params.termLabel,
        focus: params.focus,
        dataContext,
        systemPrompt,
      });
      this.bus?.emit("ai.analysis.completed", { source: result.source, model: result.model });
      return result;
    } catch (error) {
      this.bus?.emit("ai.analysis.failed", { error: (error as Error).message });
      throw error;
    }
  }

  /** OCR : chef centralisé uniquement (adapter → aiGateway). Aucun provider direct. */
  async extractGrades(input: OcrInput): Promise<OcrResult> {
    const adapter = this.requireAdapter();
    return adapter.extractGrades({
      imageDataUrl: input.imageDataUrl,
      students: input.students,
    });
  }

  /** Transcription : chef centralisé uniquement (adapter → aiGateway). Aucun provider direct. */
  async transcribe(buffer: Buffer, mimeType: string): Promise<string> {
    const adapter = this.requireAdapter();
    const audioBase64 = buffer.toString("base64");
    return adapter.transcribe({ audioBase64, mimeType });
  }
}