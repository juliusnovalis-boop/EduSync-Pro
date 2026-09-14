import { NextRequest, NextResponse } from "next/server";
import { applyCors, handlePreflight } from "@/lib/server/security/cors";

/**
 * Proxy global (anciennement « middleware ») — EduSync Pro.
 *
 * Rôle CENTRALISÉ (pentest #2) : appliquer la politique CORS restreinte sur
 * TOUTES les routes (pages SPA + API), en particulier :
 *   • traiter proprement les préflights `OPTIONS` ;
 *   • n'ajouter `Access-Control-Allow-Origin` QUE pour une origine autorisée
 *     (jamais `*` sur les routes API), en reflétant l'origine exacte ;
 *   • `Access-Control-Allow-Credentials: true` uniquement avec l'allowlist.
 *
 * En-têtes de sécurité HTTP : posés par `vercel.json` (edge Vercel, source
 * unique — SANS doublon ici pour éviter les valeurs concaténées invalides).
 *
 * NB — Authentification : les routes `/api` vérifient leur session EN BASE
 * (verifySession / requirePermission) dans chaque handler ; le proxy n'effectue
 * pas de requête DB lourde (modèle correct pour le serverless).
 */

export function proxy(request: NextRequest) {
  // 1) Préflight CORS (OPTIONS) — réponse 204 avec les bons en-têtes si autorisé.
  const preflight = handlePreflight(request);
  if (preflight) return preflight;

  // 2) Réponse normale → en-têtes CORS restreints (si origine autorisée).
  const response = NextResponse.next();
  applyCors(request, response);
  return response;
}

export const config = {
  /**
   * Matcher : tout sauf les assets statiques internes et les fichiers publics
   * servis tels quels. Contrairement au défaut Next (qui exclut `api`), on
   * INCLUT `/api` pour y appliquer la politique CORS.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};