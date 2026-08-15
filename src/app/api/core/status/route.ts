import { NextResponse } from "next/server";
import {
  Kernel,
  AIService,
  GeminiProvider,
  HuggingFaceProvider,
  LocalProvider,
  CAPABILITIES,
  type IModule,
} from "@/core";

export const dynamic = "force-dynamic";

/**
 * Endpoint d'intégration vivant : prouve que le Core fonctionne au runtime
 * (Kernel, ModuleRegistry, CapabilityCatalog, EventBus, AIProviderRegistry)
 * ET que l'isolation d'erreurs tient (un module défaillant ne casse pas le Kernel).
 * Endpoint ADDITIF — aucun endpoint existant n'est modifié.
 */

// Module fictif défaillant — pour démontrer l'isolation d'erreurs (règle non-négociable).
const failingDemoModule: IModule = {
  id: "failing-demo",
  name: "Module fictif (défaillant)",
  version: "0.0.1",
  async initialize() {
    throw new Error("Échec volontaire (test d'isolation)");
  },
};

export async function GET() {
  const kernel = new Kernel();
  const trace: string[] = [];

  kernel.eventBus.on("module.started", (e) =>
    trace.push(`started:${(e.payload as { moduleId?: string })?.moduleId}`),
  );
  kernel.eventBus.on("module.failed", (e) =>
    trace.push(`failed:${(e.payload as { moduleId?: string })?.moduleId}`),
  );

  const ai = new AIService();
  ai.registerProvider(new GeminiProvider())
    .registerProvider(new HuggingFaceProvider())
    .registerProvider(new LocalProvider());

  kernel.use(ai); // module IA + ses capacités (text.analyze, ocr.extract, audio.transcribe)
  kernel.use(failingDemoModule); // doit échouer SANS arrêter le Kernel
  kernel.container.register("ai", ai); // service résolvable par DI

  await kernel.boot();

  const active = ai.activeProvider();

  return NextResponse.json({
    ok: true,
    booted: kernel.status.booted,
    activeAiProvider: { id: active.id, label: active.label, aiEnabled: ai.aiEnabled() },
    providers: ai.providers.all().map((p) => ({ id: p.id, label: p.label, available: p.available(), priority: p.priority })),
    capabilityResolution: {
      "text.analyze": kernel.capabilities.resolve(CAPABILITIES.TEXT_ANALYZE),
      "ocr.extract": kernel.capabilities.resolve(CAPABILITIES.OCR_EXTRACT),
    },
    modules: kernel.status.modules,
    eventTrace: trace,
  });
}
