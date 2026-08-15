import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * Journal d'audit RBAC. Toute action sensible y est enregistrée
 * (USER_CREATED, ROLE_CHANGED, SCHOOL_SUSPENDED, SETTINGS_CHANGED…).
 * ⚠ Ne JAMAIS y stocker de mots de passe ou de secrets (metadata = JSON public).
 */

export const AUDIT_ACTIONS = {
  LOGIN: "LOGIN",
  LOGIN_DENIED: "LOGIN_DENIED",
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  USER_SUSPENDED: "USER_SUSPENDED",
  USER_REACTIVATED: "USER_REACTIVATED",
  ROLE_CHANGED: "ROLE_CHANGED",
  ADMIN_CREATED: "ADMIN_CREATED",
  ADMIN_SUSPENDED: "ADMIN_SUSPENDED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_RESET: "PASSWORD_RESET",
  EMAIL_CHANGED: "EMAIL_CHANGED",
  SCHOOL_CREATED: "SCHOOL_CREATED",
  SCHOOL_UPDATED: "SCHOOL_UPDATED",
  SCHOOL_SUSPENDED: "SCHOOL_SUSPENDED",
  SCHOOL_DELETED: "SCHOOL_DELETED",
  SETTINGS_CHANGED: "SETTINGS_CHANGED",
  MODULE_ENABLED: "MODULE_ENABLED",
  MODULE_DISABLED: "MODULE_DISABLED",
  API_CONFIGURATION_CHANGED: "API_CONFIGURATION_CHANGED",
  SUPER_ADMIN_ACTION: "SUPER_ADMIN_ACTION",
  ACCESS_DENIED: "ACCESS_DENIED",
  SEED_RESET: "SEED_RESET",
  ACADEMIC_YEAR_CREATED: "ACADEMIC_YEAR_CREATED",
  ACADEMIC_YEAR_UPDATED: "ACADEMIC_YEAR_UPDATED",
  ACADEMIC_YEAR_ACTIVATED: "ACADEMIC_YEAR_ACTIVATED",
  ACADEMIC_YEAR_ARCHIVED: "ACADEMIC_YEAR_ARCHIVED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntry {
  actor_id?: string | null;
  actor_role?: string | null;
  action: AuditAction | string;
  target_id?: string | null;
  result?: "success" | "denied" | "error";
  metadata?: Record<string, unknown> | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      actor_id: entry.actor_id ?? null,
      actor_role: entry.actor_role ?? null,
      action: String(entry.action),
      target_id: entry.target_id ?? null,
      result: entry.result ?? "success",
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // L'audit ne doit jamais faire échouer l'opération métier.
    console.error("[audit] échec enregistrement :", error);
  }
}
