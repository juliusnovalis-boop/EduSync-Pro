import { AsyncLocalStorage } from "node:async_hooks";
import type { NextRequest } from "next/server";

/**
 * EnvironmentManager — source unique de vérité DEMO vs PRODUCTION.
 *
 * L'environnement est déterminé CÔTÉ SERVEUR, jamais confié au seul frontend :
 *  • routes publiques  → header `x-edusync-env` / préfixe de chemin `/demo` (défaut : production) ;
 *  • routes authentifiées → l'`env` porté par le JETON est autoritaire et est
 *    croisé avec la déclaration de la requête (défense en profondeur).
 *
 * L'environnement actif est propagé via AsyncLocalStorage afin que la couche
 * d'accès aux données (`@/db`) route automatiquement vers le bon schéma PostgreSQL
 * (schéma `public` = production, schéma `demo` = démonstration) — sans jamais
 * modifier la logique métier (data.ts, pages, etc.).
 */

export type AppEnvironment = "demo" | "production";

export const DEFAULT_ENVIRONMENT: AppEnvironment = "production";

const ENV_HEADER = "x-edusync-env";

const storage = new AsyncLocalStorage<AppEnvironment>();

/** Environnement actif pour la requête courante (défaut : production). */
export function getActiveEnvironment(): AppEnvironment {
  return storage.getStore() ?? DEFAULT_ENVIRONMENT;
}

export function isDemo(): boolean {
  return getActiveEnvironment() === "demo";
}

/** Active un environnement pour le reste du contexte asynchrone courant. */
export function bindEnvironment(env: AppEnvironment): AppEnvironment {
  storage.enterWith(env);
  return env;
}

/**
 * Détection « logique » de l'environnement depuis une requête.
 * Renvoie `null` si la requête ne déclare rien explicitement
 * (afin que le jeton reste autoritaire sur les routes authentifiées).
 */
export function detectEnvironment(req: NextRequest): AppEnvironment | null {
  // 1) Cookie (posé côté client selon le chemin) — propagé automatiquement à TOUTE requête.
  const cookie = req.cookies.get("edusync_env")?.value?.trim().toLowerCase();
  if (cookie === "demo" || cookie === "production") return cookie;
  // 2) Header explicite (double sécurité).
  const header = req.headers.get(ENV_HEADER)?.trim().toLowerCase();
  if (header === "demo" || header === "production") return header;
  // 3) Préfixe de chemin.
  try {
    const path = new URL(req.url).pathname;
    if (path === "/demo" || path.startsWith("/demo/")) return "demo";
  } catch {
    /* ignore */
  }
  return null;
}

/** Environnement résolu pour une route PUBLIQUE (header/chemin, défaut production). */
export function resolveEnvironment(req: NextRequest): AppEnvironment {
  return detectEnvironment(req) ?? DEFAULT_ENVIRONMENT;
}

/**
 * À appeler en tête de chaque route PUBLIQUE touchant la base :
 * détermine l'environnement (header/chemin) et l'active pour la requête.
 */
export function bindRequestEnvironment(req: NextRequest): AppEnvironment {
  return bindEnvironment(resolveEnvironment(req));
}

/**
 * Vérification de cohérence d'un jeton sur une route authentifiée.
 * Le `env` du jeton est AUTORITAIRE. Si la requête déclare explicitement un
 * environnement différent du jeton → incohérence → on refuse (anti-usurpation).
 * Renvoie l'environnement autoritaire à activer, ou `null` si incohérent.
 */
export function authorizeTokenEnvironment(
  req: NextRequest,
  tokenEnv: string | null | undefined,
): AppEnvironment | null {
  const claimed = detectEnvironment(req);
  const env: AppEnvironment = tokenEnv === "demo" ? "demo" : "production";
  if (claimed !== null && claimed !== env) return null; // jeton ≠ déclaration → refus
  return env;
}
