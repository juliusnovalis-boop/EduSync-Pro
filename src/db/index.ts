import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { getActiveEnvironment, isDemo, type AppEnvironment } from "@/lib/server/environment";

/**
 * Couche d'accès aux données — deux espaces ISOLÉS dans la même base PostgreSQL :
 *
 *   • schéma `public`    → environnement PRODUCTION (officiel)
 *   • schéma `demo`      → environnement DÉMONSTRATION (sandbox isolée)
 *
 * L'isolation repose sur le `search_path` de chaque pool : chaque connexion
 * « voit » uniquement son schéma, donc aucune requête métier (data.ts, pages…)
 * n'a à être modifiée — elle opère toujours sur la table non qualifiée et le
 * pool actif résout le bon schéma.
 *
 * Le `db` exporté est un mandataire (Proxy) qui sélectionne automatiquement le
 * bon pool selon l'environnement de la requête courante (AsyncLocalStorage,
 * voir lib/server/environment.ts). Défaut : production — l'environnement
 * officiel ne peut JAMAIS être contaminé par la démo.
 */

const PRODUCTION_URL = process.env.DATABASE_URL;
if (!PRODUCTION_URL) throw new Error("DATABASE_URL is required");

const globalForDb = globalThis as typeof globalThis & {
  __edusyncPools?: Record<AppEnvironment, Pool>;
};

function makePool(env: AppEnvironment): Pool {
  const searchPath = env === "demo" ? "demo" : "public";
  return new Pool({
    connectionString: PRODUCTION_URL,
    // Positionné à l'établissement de chaque connexion : toutes les requêtes
    // non qualifiées résolvent dans le schéma ciblé (isolement réel).
    options: `-c search_path=${searchPath}`,
  });
}

const pools: Record<AppEnvironment, Pool> =
  globalForDb.__edusyncPools ??
  (globalForDb.__edusyncPools = {
    production: makePool("production"),
    demo: makePool("demo"),
  });

export const productionPool = pools.production;
export const demoPool = pools.demo;

type DrizzleDb = NodePgDatabase<typeof schema>;

const databases: Record<AppEnvironment, DrizzleDb> = {
  production: drizzle(pools.production, { schema }),
  demo: drizzle(pools.demo, { schema }),
};

/**
 * Instance Drizzle de l'environnement courant. Par défaut production.
 * Utilisée par le mandataire `db` et directement par les routines
 * d'amorçage qui doivent cibler un schéma précis.
 */
export function currentDatabase(): DrizzleDb {
  return databases[getActiveEnvironment()];
}

/**
 * Crée le schéma `demo` et y duplique toutes les tables du schéma `public`
 * (structure identique). Idempotent. Appelé paresseusement au premier accès démo.
 */
export async function ensureDemoSchema(): Promise<void> {
  const client = await demoPool.connect();
  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS demo");
    const { rows } = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    for (const row of rows) {
      const name = String(row.tablename);
      // Validation stricte : n'accepter que des noms de tables valides.
      if (!/^[a-z_][a-z0-9_]*$/.test(name)) continue;
      await client.query(
        `CREATE TABLE IF NOT EXISTS demo."${name}" (LIKE public."${name}" INCLUDING ALL)`,
      );
      // Synchronise les colonnes manquantes (schéma démo potentiellement antérieur
      // à une évolution du schéma public — ex. ajout de last_login_at).
      const pubCols = (
        await client.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
          [name],
        )
      ).rows;
      const demoCols = new Set(
        (
          await client.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema='demo' AND table_name=$1`,
            [name],
          )
        ).rows.map((r: { column_name: string }) => r.column_name),
      );
      for (const col of pubCols) {
        if (!demoCols.has(col.column_name)) {
          // Ajout nullable (le bac à sable démo tolère les valeurs nulles).
          await client.query(
            `ALTER TABLE demo."${name}" ADD COLUMN "${col.column_name}" ${col.data_type}`,
          );
        }
      }
    }
  } finally {
    client.release();
  }
}

/** Amorce le schéma démo si l'environnement courant est « demo ». */
export async function ensureCurrentSchema(): Promise<void> {
  if (isDemo()) await ensureDemoSchema();
}

/**
 * Mandataire `db` : toutes les opérations existantes (`db.select()`, `db.insert()`…)
 * fonctionnent à l'identique, mais sont automatiquement routées vers le schéma
 * de l'environnement de la requête courante.
 */
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const target = currentDatabase() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
  },
}) as DrizzleDb;
