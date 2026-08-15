/**
 * Contrat d'accès aux données (IRepository).
 * `src/lib/server/data.ts` implémente DÉJÀ ce contrat (repository générique).
 * P5 : on l'alignera formellement ; aucune signature existante ne change.
 */
export type Row = Record<string, unknown>;

export interface IRepository {
  list(table: string, options?: { order?: string; ascending?: boolean; limit?: number }): Promise<Row[]>;
  create(table: string, values: Row): Promise<Row>;
  update(table: string, id: string, values: Row): Promise<Row | null>;
  remove(table: string, id: string): Promise<boolean>;
  count(table: string): Promise<number>;
}

/** Token DI pour le repository par défaut. */
export const REPOSITORY_TOKEN = "repository";
