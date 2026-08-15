/**
 * EduSync Pro — Core (API publique).
 *
 * Socle modulaire, extensible et découplé. Code ADDITIF : aucun module applicatif
 * existant n'est modifié. Les phases suivantes branchent les features sur ce Core.
 */

// Kernel & primitives
export { Kernel } from "./kernel/kernel";
export { EventBus } from "./kernel/event-bus";
export type { EventHandler } from "./kernel/event-bus";
export { ServiceContainer } from "./kernel/container";
export { ModuleRegistry } from "./kernel/registry";
export { CapabilityCatalog, CAPABILITIES } from "./kernel/capabilities";
export { ConfigManager } from "./kernel/config";

// Contrats
export type {
  IModule,
  IPlugin,
  IService,
  ICapability,
  ModuleContext,
  PluginManifest,
  CoreEvent,
  CoreEventMap,
} from "./interfaces";

// Services IA
export type { IAIProvider, AnalysisParams, ChatMessage, ChatOptions, OcrInput, OcrResult } from "./services/ai/ai-provider";
export { AIProviderRegistry } from "./services/ai/registry";
export { AIService } from "./services/ai/ai-service";
export { GeminiProvider, HuggingFaceProvider, LocalProvider } from "./services/ai/providers";

// Contrats data / identité
export type { IRepository, Row } from "./services/repository";
export { REPOSITORY_TOKEN } from "./services/repository";
export type { IIdentityService, IdentityPayload } from "./services/identity";
export { IDENTITY_TOKEN } from "./services/identity";
