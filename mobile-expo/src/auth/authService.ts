import { api } from "../api/client";
import type { LoginResponse, SessionInfo } from "../types";
import { tokenStorage } from "./tokenStorage";

/** Service d'authentification mobile : login / logout / restauration de session. */
export const authService = {
  async login(identifier: string, password: string): Promise<SessionInfo> {
    const data = await api.post<LoginResponse>("/api/auth/login", { identifier, password });
    if (!data.ok || !data.session || !data.token) {
      throw new Error(data.error || "Connexion impossible.");
    }
    await tokenStorage.saveToken(data.token);
    await tokenStorage.saveSession(data.session);
    return data.session;
  },

  async logout(): Promise<void> {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // On ignore les erreurs serveur : la session locale est supprimée quoi qu'il arrive.
    }
    await tokenStorage.clearAll();
  },

  /** Restaure la session au démarrage ; null si absente/expirée. */
  async restore(): Promise<SessionInfo | null> {
    const token = await tokenStorage.getToken();
    const session = await tokenStorage.getSession<SessionInfo>();
    if (!token || !session) {
      await tokenStorage.clearAll();
      return null;
    }
    // Vérification côté serveur (révocation / expiration réelles).
    try {
      await api.get("/api/auth/me");
      return session;
    } catch {
      await tokenStorage.clearAll();
      return null;
    }
  },
};
