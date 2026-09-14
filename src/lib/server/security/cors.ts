import { NextRequest, NextResponse } from "next/server";
import {
  isAllowedOrigin as policyIsAllowedOrigin,
  CORS_ALLOW_METHODS,
  CORS_ALLOW_HEADERS,
} from "./policy";

/**
 * CORS restreint — EduSync Pro.
 *
 * Règle de sécurité (pentest #2) :
 *   • JAMAIS `Access-Control-Allow-Origin: *` sur les routes API.
 *   • Origine autorisée = origine PRODUCTION exacte, plus les previews Vercel
 *     (`*.vercel.app`) UNIQUEMENT en environnement non-production.
 *   • Préflight `OPTIONS` géré avec les bons en-têtes.
 *   • `Access-Control-Allow-Credentials: true` (sessions sur cookie HttpOnly)
 *     UNIQUEMENT avec l'allowlist d'origines précise.
 *
 * La règle de décision pure vit dans `./policy.ts` (testable sans Next).
 */

/** Vrai (non-production) si les previews Vercel sont autorisées. */
function allowPreviewOrigins(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function isAllowedOrigin(origin: string | null): boolean {
  return policyIsAllowedOrigin(origin, allowPreviewOrigins());
}

/**
 * Applique les en-têtes CORS sur une réponse SI l'origine est autorisée.
 * Ne met JAMAIS `*` : on reflète l'origine exacte, sinon rien.
 */
export function applyCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin");
  if (!origin) return res;
  if (!isAllowedOrigin(origin)) {
    // Origine non autorisée : AUCUN en-tête CORS (le navigateur bloque la lecture).
    return res;
  }
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
  res.headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  res.headers.set("Access-Control-Max-Age", "600");
  return res;
}

/**
 * Gère une requête préflight `OPTIONS` → réponse `204` avec les en-têtes CORS
 * nécessaires, ou `null` si la requête n'est pas un préflight.
 */
export function handlePreflight(req: NextRequest): NextResponse | null {
  if (req.method.toUpperCase() !== "OPTIONS") return null;
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 204 });
  if (origin && isAllowedOrigin(origin)) {
    applyCors(req, res);
  }
  return res;
}