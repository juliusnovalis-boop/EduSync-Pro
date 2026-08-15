/**
 * Client API centralisé pour EduSync Pro.
 *
 * En mode WEB (Next.js), les appels sont relatifs (`/api/...`) et servis par
 * le même serveur. En mode MOBILE (Capacitor/Android), le frontend est servi
 * depuis un WebView local et doit pointer vers le backend distant.
 *
 * La base URL est résolue dans cet ordre :
 *   1. Variable d'environnement `NEXT_PUBLIC_API_URL` (build web)
 *   2. Variable globale `window.EDUSYNC_API_URL` (injectée par Capacitor)
 *   3. Chaîne vide → appels relatifs (mode web par défaut)
 */

export const API_BASE_URL: string = resolveBaseUrl();

function resolveBaseUrl(): string {
  if (typeof window !== "undefined") {
    const injected = (window as unknown as { EDUSYNC_API_URL?: string }).EDUSYNC_API_URL;
    if (injected) return injected.replace(/\/$/, "");
  }
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");
  return "";
}

/** Prépare une URL API absolue ou relative selon le contexte. */
export function apiUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${clean}`;
}

/** fetch() vers l'API avec la bonne base URL. */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === "string") {
    return fetch(apiUrl(input), init);
  }
  return fetch(input, init);
}