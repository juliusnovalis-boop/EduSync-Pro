/**
 * Contrats fondamentaux du Core EduSync Pro.
 * Source de vérité pour modules, plugins, services, capacités et événements.
 * Cette couche ne dépend de RIEN d'applicationnel — uniquement de types.
 */

/* ----------------------------- Événements ------------------------------ */

/** Événement transiting par l'EventBus. `type` est une chaîne hiérarchique ("ai.analysis.completed"). */
export interface CoreEvent<T = unknown> {
  type: string;
  payload?: T;
  timestamp: number;
}

/** Map extensible des événements (un module peut l'enrichir par fusion de types). */
export interface CoreEventMap {
  "module.registered": { moduleId: string };
  "module.started": { moduleId: string };
  "module.failed": { moduleId: string; error: string };
  "ai.analysis.started": { term: string };
  "ai.analysis.completed": { source: string; model?: string };
  "ai.analysis.failed": { error: string };
  [type: string]: unknown;
}

export type EventHandler<T = unknown> = (event: CoreEvent<T>) => void;

/* ------------------------------- Modules ------------------------------- */

/** Contexte passé à un module lors de initialize(). */
export interface ModuleContext {
  container: import("../kernel/container").ServiceContainer;
  eventBus: import("../kernel/event-bus").EventBus;
  registry: import("../kernel/registry").ModuleRegistry;
  capabilities: import("../kernel/capabilities").CapabilityCatalog;
  config: import("../kernel/config").ConfigManager;
}

export interface IModule {
  /** Identifiant stable et unique (ex. "ai", "ocr", "qr"). */
  id: string;
  name: string;
  version: string;
  /** Capacités métier exposées (ex. ["ocr.extract"]). */
  capabilities?: string[];
  /** Modules requis pour démarrer (résolus avant initialize). */
  dependencies?: string[];
  /** Initialise les ressources du module. Doit être idempotente et isolée. */
  initialize?(ctx: ModuleContext): Promise<void> | void;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
  /** Désactivable à chaud (feature flag) sans désinstaller. */
  enabled?: boolean;
}

/* ------------------------------- Plugins ------------------------------- */

/** Métadonnées déclaratives d'un plugin (extensibilité externe). */
export interface PluginManifest {
  name: string;
  version: string;
  author?: string;
  description?: string;
  dependencies?: string[];
  capabilities?: string[];
  provides?: string[]; // ex. ["ai-provider:gemini"]
}

/**
 * Un plugin est une extension externe qui s'enregistre auprès du Core
 * (fournit services, providers, outils, capacités…) sans modifier le Core.
 */
export interface IPlugin {
  manifest: PluginManifest;
  /** Installe le plugin dans le Kernel (registres + container). */
  install(ctx: ModuleContext): Promise<void> | void;
}

/* --------------------------- Services / DI ----------------------------- */

/** Marqueur pour un service enregistré dans le ServiceContainer. */
export interface IService {
  readonly id: string;
}

/* ----------------------------- Capacités ------------------------------- */

/** Une capacité = verbe métier exposé, résolu vers le module qui le réalise. */
export interface ICapability {
  id: string;
  description?: string;
}
