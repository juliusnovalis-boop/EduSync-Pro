import type { IModule, ModuleContext } from "../interfaces";

/**
 * Registre des modules : découverte, enregistrement, activation/désactivation,
 * recherche par capacité. L'initialisation est ISOLÉE : un module défaillant
 * est marqué en erreur sans arrêter les autres.
 */
export class ModuleRegistry {
  private modules = new Map<string, IModule>();
  private failed = new Set<string>();
  private started = new Set<string>();

  register(module: IModule): this {
    if (this.modules.has(module.id)) {
      throw new Error(`Module déjà enregistré : "${module.id}"`);
    }
    this.modules.set(module.id, { ...module, enabled: module.enabled ?? true });
    return this;
  }

  get(id: string): IModule | undefined {
    return this.modules.get(id);
  }

  has(id: string): boolean {
    return this.modules.has(id);
  }

  isEnabled(id: string): boolean {
    return this.modules.get(id)?.enabled ?? false;
  }

  enable(id: string): this {
    const m = this.modules.get(id);
    if (m) m.enabled = true;
    return this;
  }

  disable(id: string): this {
    const m = this.modules.get(id);
    if (m) m.enabled = false;
    return this;
  }

  isFailed(id: string): boolean {
    return this.failed.has(id);
  }

  all(): IModule[] {
    return [...this.modules.values()];
  }

  /** Modules exposant une capacité donnée (et activés). */
  byCapability(capability: string): IModule[] {
    return this.all().filter((m) => m.enabled && m.capabilities?.includes(capability));
  }

  /** Initialise puis démarre tous les modules activés, en isolant les échecs. */
  async initializeAll(ctx: ModuleContext): Promise<void> {
    for (const module of this.all()) {
      if (!module.enabled || this.failed.has(module.id)) continue;
      await this.safeInit(module, ctx);
    }
  }

  private async safeInit(module: IModule, ctx: ModuleContext): Promise<void> {
    try {
      // Vérification des dépendances (compatibilité de versions).
      for (const dep of module.dependencies ?? []) {
        if (!this.modules.has(dep)) {
          throw new Error(`Dépendance manquante : "${dep}"`);
        }
      }
      await module.initialize?.(ctx);
      await module.start?.();
      this.started.add(module.id);
      ctx.eventBus.emit("module.started", { moduleId: module.id });
    } catch (error) {
      this.failed.add(module.id);
      const message = (error as Error).message;
      ctx.eventBus.emit("module.failed", { moduleId: module.id, error: message });
      console.error(`[ModuleRegistry] module "${module.id}" désactivé (échec init):`, message);
    }
  }

  async stopAll(): Promise<void> {
    for (const module of [...this.modules.values()].reverse()) {
      if (this.started.has(module.id)) {
        try {
          await module.stop?.();
        } catch (error) {
          console.error(`[ModuleRegistry] stop "${module.id}":`, error);
        }
        this.started.delete(module.id);
      }
    }
  }
}
