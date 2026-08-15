/**
 * Gestionnaire de configuration centralisé.
 * Source unique pour : variables d'environnement + feature flags (modules).
 * (P3 y branchera aussi la lecture des app_settings en base.)
 */
export class ConfigManager {
  /** module id → enabled */
  private moduleFlags = new Map<string, boolean>();

  /** Valeur d'environnement nettoyée (guillemets/espaces retirés). */
  env(key: string, fallback = ""): string {
    const raw = process.env[key];
    if (!raw) return fallback;
    return String(raw).trim().replace(/^["']|["']$/g, "").trim() || fallback;
  }

  envBool(key: string, fallback = false): boolean {
    const v = this.env(key, String(fallback)).toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
  }

  /** Active/désactive un module (feature flag runtime). */
  setModuleEnabled(moduleId: string, enabled: boolean): void {
    this.moduleFlags.set(moduleId, enabled);
  }

  isModuleEnabled(moduleId: string): boolean {
    return this.moduleFlags.get(moduleId) ?? true; // activé par défaut
  }
}
