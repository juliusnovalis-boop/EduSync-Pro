import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Configuration API du client mobile EduSync Pro.
 *
 * Priorité de résolution de l'URL de l'API :
 *   1. variable d'environnement EXPO_PUBLIC_API_URL (recommandée) —
 *      ex. dans mobile-expo/.env.local :
 *        EXPO_PUBLIC_API_URL=http://192.168.1.50:3000
 *   2. repli automatique : IP LAN de la machine hôte (si expo dev-server détecté),
 *   3. repli final : localhost:3000 (simulateur / émulateur).
 *
 * ⚠ Un téléphone physique sur Expo Go NE PEUT PAS joindre `localhost` :
 * il doit joindre l'IP locale du PC (même réseau Wi-Fi, port 3000 ouvert
 * dans le pare-feu Windows).
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/+$/, "");

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host && !["localhost", "127.0.0.1"].includes(host)) {
      return `http://${host}:3000`;
    }
  }
  return Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
}

export const API_URL = resolveApiUrl();

/** Environnement EduSync (« production » ou « demo ») envoyé au backend. */
export const EDUSYNC_ENV = (process.env.EXPO_PUBLIC_EDUSYNC_ENV ?? "production").trim().toLowerCase() === "demo" ? "demo" : "production";

