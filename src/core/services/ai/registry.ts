import type { IAIProvider } from "./ai-provider";

/**
 * Registre des fournisseurs IA : sélectionne le provider actif par priorité.
 * Remplace les if/else dupliqués (3 sites) par UNE source de vérité.
 * Ajouter un provider = registry.register(...) — zéro condition à coder.
 */
export class AIProviderRegistry {
  private providers = new Map<string, IAIProvider>();

  register(provider: IAIProvider): this {
    this.providers.set(provider.id, provider);
    return this;
  }

  all(): IAIProvider[] {
    return [...this.providers.values()].sort((a, b) => a.priority - b.priority);
  }

  /** Providers réellement disponibles (clés configurées), triés par priorité. */
  available(): IAIProvider[] {
    return this.all().filter((p) => p.available());
  }

  /** Provider actif = premier disponible par priorité, sinon "local". */
  resolve(): IAIProvider {
    return this.available()[0] ?? this.resolveById("local") ?? this.all()[0];
  }

  resolveById(id: string): IAIProvider | undefined {
    return this.providers.get(id);
  }

  /** Premier provider disponible supportant une capacité donnée. */
  resolveByCapability(cap: "vision" | "audio" | "chat"): IAIProvider | undefined {
    return this.available().find((p) => p.capabilities[cap] && typeof p[cap === "vision" ? "extractGrades" : cap === "audio" ? "transcribe" : "chat"] === "function");
  }
}
