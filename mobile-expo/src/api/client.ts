import { API_URL, EDUSYNC_ENV } from "../config";
import { tokenStorage } from "../auth/tokenStorage";

/**
 * Client API mobile EduSync Pro.
 * Réutilise le modèle de src/spa/lib/api.ts mais 100 % React Native :
 * fetch + AsyncStorage pour le jeton Bearer. Aucune API navigateur
 * (pas de window / document / localStorage).
 */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

let onUnauthorized: (() => void) | null = null;
/** Enregistré par l'AuthProvider : déconnexion automatique sur 401. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await tokenStorage.getToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  headers["x-edusync-env"] = EDUSYNC_ENV;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Impossible de joindre le serveur (${API_URL}). Vérifiez le réseau.`);
  }

  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
    throw new ApiError(401, "Session expirée.");
  }

  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      `Erreur ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  apiUrl: API_URL,
};
