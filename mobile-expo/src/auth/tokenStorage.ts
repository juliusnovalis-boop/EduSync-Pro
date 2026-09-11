import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Stockage sécurisé du jeton (MVP : AsyncStorage).
 * Centralisé ici pour pouvoir basculer plus tard vers expo-secure-store
 * sans toucher au reste du code.
 */
const TOKEN_KEY = "edusync_token";
const SESSION_KEY = "edusync_session";

export const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },
  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
  async saveSession(session: unknown): Promise<void> {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },
  async getSession<T>(): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(SESSION_KEY);
  },
};
