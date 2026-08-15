import type { CoreEvent } from "../interfaces";

/** Fonction écouteur générique (payload typé par l'appelant). */
export type EventHandler<T = unknown> = (event: CoreEvent<T>) => void;

/**
 * Bus d'événements découplé.
 * Permet à un producteur d'émettre sans connaître ses consommateurs
 * (Open/Closed : ajouter un écouteur ne modifie jamais le producteur).
 */
export class EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers = new Map<string, Set<EventHandler<any>>>();

  on<T = unknown>(type: string, handler: EventHandler<T>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler);
    return () => this.off(type, handler as EventHandler);
  }

  once<T = unknown>(type: string, handler: EventHandler<T>): () => void {
    const wrap = ((event: CoreEvent) => {
      this.off(type, wrap);
      (handler as EventHandler)(event);
    }) as EventHandler;
    return this.on(type, wrap);
  }

  off(type: string, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit<T = unknown>(type: string, payload?: T): void {
    const event: CoreEvent<T> = { type, payload, timestamp: Date.now() };
    // Émission isolée : un écouteur défaillant n'interrompt pas les autres.
    for (const handler of this.handlers.get(type) ?? []) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[EventBus] écouteur défaillant sur "${type}":`, error);
      }
    }
  }

  listenerCount(type: string): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}
