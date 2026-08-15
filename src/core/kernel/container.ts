/**
 * Conteneur d'injection de dépendances (DI).
 * - register(token, instance)  : singleton
 * - factory(token, () => T)    : création paresseuse (résolue une fois)
 * - resolve(token)             : lève si absent
 *
 * Permet de substituer une implémentation (ex. OpenAI ↔ Gemini) sans modifier l'appelant.
 */
type Factory<T> = () => T | Promise<T>;

export class ServiceContainer {
  private instances = new Map<string, unknown>();
  private factories = new Map<string, Factory<unknown>>();

  register<T>(token: string, instance: T): this {
    this.instances.set(token, instance);
    this.factories.delete(token);
    return this;
  }

  factory<T>(token: string, factory: Factory<T>): this {
    this.factories.set(token, factory as Factory<unknown>);
    this.instances.delete(token);
    return this;
  }

  has(token: string): boolean {
    return this.instances.has(token) || this.factories.has(token);
  }

  async resolve<T>(token: string): Promise<T> {
    if (this.instances.has(token)) return this.instances.get(token) as T;
    const factory = this.factories.get(token);
    if (!factory) throw new Error(`Service introuvable : "${token}"`);
    const instance = await factory();
    this.instances.set(token, instance);
    this.factories.delete(token);
    return instance as T;
  }

  /** Résolution synchrone (uniquement pour singletons déjà instanciés). */
  resolveSync<T>(token: string): T {
    if (this.instances.has(token)) return this.instances.get(token) as T;
    throw new Error(`Service non instancié (utilisez resolve async) : "${token}"`);
  }
}
