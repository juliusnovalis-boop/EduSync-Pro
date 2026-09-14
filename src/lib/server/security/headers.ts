import { NextResponse } from "next/server";

/**
 * En-têtes de sécurité HTTP appliqués à TOUTES les réponses (routes API + SPA).
 *
 * Note CSP (assumé et documenté) : le rendu est 100 % client-side
 * (`BAILOUT_TO_CLIENT_SIDE_RENDERING`). Next.js injecte des scripts inline pour
 * l'hydratation/RSC ; un strict `script-src 'self'` les bloquerait. On documente
 * donc le compromis `'unsafe-inline'` côté script, tout en gardant :
 *   • `default-src 'self'` → aucune origine tierce par défaut ;
 *   • `connect-src 'self'` → AUCUN appel API LLM/IA externe depuis le navigateur
 *     (les clés fournisseur restent côté serveur, jamais exposées) ;
 *   • `frame-ancestors 'none'` → impossible d'intégrer l'app dans une iframe.
 *
 * Ces valeurs sont appliquées en amont (vercel.json edge + next.config headers)
 * et redondées ici pour les exécutions locales autonomes.
 */

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-src 'none'",
  "X-Frame-Options": "DENY", // (redondant avec frame-ancestors ; double défense)
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/** Applique les en-têtes de sécurité sur une réponse (idempotent). */
export function applySecurityHeaders(res: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    // Ne pas écraser une valeur déjà posée (ex. par le edge Vercel).
    if (!res.headers.has(name)) {
      res.headers.set(name, value);
    }
  }
  return res;
}

/** Expose la liste pour tests et pour la config (vercel/next). */
export function securityHeaderValue(name: string): string | undefined {
  return SECURITY_HEADERS[name];
}