import crypto from "node:crypto";
import { normalizeRole, type Role } from "./rbac";

/**
 * Configuration de sécurité centralisée — source unique des durées de session
 * et du secret HMAC. Aucune valeur « 7 jours » dispersée dans le code.
 *
 * Politique par rôle (conformément à la hiérarchie STUDENT < TEACHER < ADMIN < SUPER_ADMIN) :
 *   • STUDENT / PARENT / TEACHER → 7 jours
 *   • ADMIN                     → configurable (ADMIN_SESSION_DAYS, défaut 2 jours)
 *   • SUPER_ADMIN               → courte, sécurité renforcée (SUPER_ADMIN_SESSION_HOURS, défaut 8 h)
 */

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function envInt(name: string, fallback: number, min = 1): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

/** Durées de session par rôle canonique (millisecondes). */
export const SESSION_DURATIONS_MS: Record<Role, number> = {
  STUDENT: 7 * DAY,
  PARENT: 7 * DAY,
  TEACHER: 7 * DAY,
  ADMIN: envInt("ADMIN_SESSION_DAYS", 2) * DAY, // 1–3 jours typiques
  SUPER_ADMIN: envInt("SUPER_ADMIN_SESSION_HOURS", 8) * HOUR, // courte, renforcée
};

/** Durée applicable à un rôle (chute par défaut sur STUDENT = 7 jours). */
export function sessionDurationMs(role: string | null | undefined): number {
  return SESSION_DURATIONS_MS[normalizeRole(role)] ?? 7 * DAY;
}

/**
 * Secret HMAC serveur — UNIQUEMENT depuis la configuration sécurisée.
 * Jamais dans le frontend, le bundle navigateur, localStorage ou les logs.
 * Priorité : SESSION_SECRET > DATABASE_URL (toujours présent). Aucun repli codé en dur.
 */
export function hmacSecret(): string {
  const s = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!s) throw new Error("Secret de session indisponible (SESSION_SECRET / DATABASE_URL requis).");
  return s;
}

/** Identifiant de session opaque, cryptographiquement aléatoire. */
export function newSessionId(): string {
  return crypto.randomUUID();
}
