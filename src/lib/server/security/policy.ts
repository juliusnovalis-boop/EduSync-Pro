/**
 * Policy de sécurité — EduSync Pro.
 *
 * Module PUR : aucune importation (ni `next/server`, ni `@/db`), testable en
 * Node natif (tests de non-régression `scripts/security-regression.test.mjs`).
 * Centralise les règles décisionnelles de CORS et d'extraction IP.
 */

/* -------------------------------- CORS ----------------------------------- */

/** Origine de production EXACTE (source de vérité). */
export const PRODUCTION_ORIGIN = "https://edu-sync-pro-nine.vercel.app";

/** Teste si `origin` correspond à un sous-domaine de Vercel (preview). */
export function isVercelPreview(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && u.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

/**
 * Une origine est-elle autorisée ? (logique pure, injectable)
 *  • `allowPreview` (vrai en dev) → autorise aussi les previews `*.vercel.app`.
 *  • En production → UNIQUEMENT l'origine exacte.
 */
export function isAllowedOrigin(origin: string | null, allowPreview: boolean): boolean {
  if (!origin) return false;
  if (origin === PRODUCTION_ORIGIN) return true;
  if (allowPreview && isVercelPreview(origin)) return true;
  return false;
}

/** Méthodes et en-têtes autorisés sur les préflights CORS. */
export const CORS_ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
export const CORS_ALLOW_HEADERS = "Content-Type, Authorization";

/* --------------------- Extraction de l'IP client ------------------------- */

/**
 * Extrait l'IP depuis la chaîne de proxy (Vercel). On ne prend QUE le premier
 * élément de `x-forwarded-for` (l'origine), les suivants étant forgeables.
 */
export function ipFromForwarded(forwarded: string | null | undefined, realIp: string | null | undefined): string {
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  if (realIp) return realIp.trim();
  return "unknown";
}