import type { IModule, IPlugin, ModuleContext } from "../interfaces";
import { EventBus } from "./event-bus";
import { ServiceContainer } from "./container";
import { ModuleRegistry } from "./registry";
import { CapabilityCatalog } from "./capabilities";
import { ConfigManager } from "./config";

/**
 * Kernel — point d'assemblage du Core.
 * Détient le container (DI), le bus, le registre, le catalogue et la config.
 * Les plugins/modules s'enregistrent via use(); le démarrage est isolé.
 */
export class Kernel {
  readonly container = new ServiceContainer();
  readonly eventBus = new EventBus();
  readonly registry = new ModuleRegistry();
  readonly capabilities = new CapabilityCatalog();
  readonly config = new ConfigManager();
  private booted = false;

  constructor() {
    // Le Core s'enregistre lui-même comme services résolvables.
    this.container.register("eventBus", this.eventBus);
    this.container.register("config", this.config);
    this.container.register("capabilities", this.capabilities);
    this.container.register("registry", this.registry);
  }

  /** Enregistre un module (avant bootstrap). */
  use(module: IModule): this {
    this.registry.register(module);
    for (const cap of module.capabilities ?? []) {
      this.capabilities.register(cap, module.id);
    }
    this.eventBus.emit("module.registered", { moduleId: module.id });
    return this;
  }

  /** Installe un plugin externe. */
  async install(plugin: IPlugin): Promise<this> {
    const ctx = this.context();
    await plugin.install(ctx);
    for (const cap of plugin.manifest.capabilities ?? []) {
      this.capabilities.register(cap, plugin.manifest.name);
    }
    return this;
  }

  /** Initialise tous les modules (idempotent, isolé). */
  async boot(): Promise<void> {
    if (this.booted) return;
    this.booted = true;
    await this.registry.initializeAll(this.context());
  }

  private context(): ModuleContext {
    return {
      container: this.container,
      eventBus: this.eventBus,
      registry: this.registry,
      capabilities: this.capabilities,
      config: this.config,
    };
  }

  get status() {
    return {
      booted: this.booted,
      modules: this.registry.all().map((m) => ({
        id: m.id,
        name: m.name,
        version: m.version,
        enabled: m.enabled ?? true,
        failed: this.registry.isFailed(m.id),
        capabilities: m.capabilities ?? [],
      })),
      capabilities: this.capabilities.list(),
    };
  }
}
