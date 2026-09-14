import { productionPool } from "@/db";
import {
  LoginRateLimiter,
  type BucketRow,
  type LockRow,
  type RateLimitStore,
} from "./rate-limit-core";

/**
 * Store de rate limiting PostgreSQL (persistant, serverless-safe).
 *
 * Le moteur pure (tests, clés, policy, classes) vit dans `./rate-limit-core` ;
 * ici on branche la persistance réelle (PostgreSQL, la couche persistante déjà
 * en place) et on expose l'instance de production. Tables auto-créées à la
 * première utilisation (`CREATE TABLE IF NOT EXISTS`) — idempotent en scale-out.
 */

export * from "./rate-limit-core";

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    key text PRIMARY KEY,
    count integer NOT NULL DEFAULT 0,
    window_started_at text NOT NULL,
    updated_at text NOT NULL
  );
  CREATE TABLE IF NOT EXISTS account_lock (
    key text PRIMARY KEY,
    attempts integer NOT NULL DEFAULT 0,
    locked_until text NOT NULL,
    updated_at text NOT NULL
  );
`;

class PostgresRateLimitStore implements RateLimitStore {
  ensureSchema(): Promise<void> {
    return productionPool.query(SCHEMA_DDL).then(() => undefined);
  }

  async getBucket(key: string): Promise<BucketRow | undefined> {
    const { rows } = await productionPool.query<BucketRow>(
      "SELECT count, window_started_at FROM rate_limit_buckets WHERE key = $1",
      [key],
    );
    return rows[0];
  }

  async upsertBucket(key: string, count: number, windowStartedAtIso: string): Promise<void> {
    await productionPool.query(
      `INSERT INTO rate_limit_buckets (key, count, window_started_at, updated_at)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (key) DO UPDATE
         SET count = $2, window_started_at = $3, updated_at = $3`,
      [key, count, windowStartedAtIso],
    );
  }

  async getLock(key: string): Promise<LockRow | undefined> {
    const { rows } = await productionPool.query<LockRow>(
      "SELECT attempts, locked_until FROM account_lock WHERE key = $1",
      [key],
    );
    return rows[0];
  }

  async upsertLock(key: string, attempts: number, lockedUntilIso: string): Promise<void> {
    await productionPool.query(
      `INSERT INTO account_lock (key, attempts, locked_until, updated_at)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (key) DO UPDATE
         SET attempts = $2, locked_until = $3, updated_at = $3`,
      [key, attempts, lockedUntilIso],
    );
  }

  async deleteAll(...keys: string[]): Promise<void> {
    for (const key of keys) {
      await productionPool.query("DELETE FROM rate_limit_buckets WHERE key = $1", [key]);
      await productionPool.query("DELETE FROM account_lock WHERE key = $1", [key]);
    }
  }
}

/** Store singleton PostgreSQL (produit). */
export const postgresRateLimitStore: RateLimitStore = new PostgresRateLimitStore();

/** S'assure que les tables de rate-limiting existent (idempotent, scale-out safe). */
export async function ensureRateLimitSchema(): Promise<void> {
  await postgresRateLimitStore.ensureSchema();
}

/** Instance de production (store PostgreSQL persistant). */
export const loginRateLimiter = new LoginRateLimiter(postgresRateLimitStore);