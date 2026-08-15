/**
 * EnvironmentManager (frontend) — détermine si l'application s'exécute en
 * DÉMONSTRATION (chemin /demo) ou en PRODUCTION (tout le reste).
 *
 * L'environnement est déduit du CHEMIN courant (source fiable, non falsifiable
 * par l'utilisateur) puis consigné dans un cookie `edusync_env` propagé
 * automatiquement à toutes les requêtes /api/* (le backend l'utilise pour
 * router vers le bon schéma de données).
 */

export type AppEnvironment = "demo" | "production";

export const ENV_COOKIE = "edusync_env";

export function detectEnvironment(): AppEnvironment {
  if (typeof window === "undefined") return "production";
  const path = window.location.pathname;
  return path === "/demo" || path.startsWith("/demo/") ? "demo" : "production";
}

let cached: AppEnvironment | null = null;

/** Environnement courant (stable pendant la durée de vie de la page). */
export function currentEnvironment(): AppEnvironment {
  if (cached) return cached;
  cached = detectEnvironment();
  persistCookie(cached);
  return cached;
}

export function isDemoEnv(): boolean {
  return currentEnvironment() === "demo";
}

/** Pose le cookie d'environnement (path=/ → envoyé à toutes les routes API). */
function persistCookie(env: AppEnvironment) {
  if (typeof document === "undefined") return;
  document.cookie = `${ENV_COOKIE}=${env}; path=/; SameSite=Lax; max-age=2592000`;
}

/** URL d'authentification dans l'environnement courant (préfixe /demo si démo). */
export function authPath(): string {
  return isDemoEnv() ? "/demo/auth" : "/auth";
}
