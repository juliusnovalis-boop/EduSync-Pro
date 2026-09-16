import { PERMISSIONS, ROLES, roleRank } from "./rbac";
import type { TableName } from "./data";

/**
 * F-7 (pentest #2) — Matrice d'autorisation de la couche data générique.
 *
 * DENY BY DEFAULT :
 *  • une table inconnue est refusée (assertTable) ;
 *  • une opération non explicitement autorisée par la matrice est refusée ;
 *  • `write: null` = opération interdite via l'API générique (table gérée par
 *    une route dédiée, ex. students/teachers → /api/auth/users) ;
 *  • `read: null` = lecture autorisée à tout acteur authentifié (table publique
 *    ou pédagogique), LE scoping par rôle restant appliqué (scopeRowsForActor) ;
 *  • `ownerScoped` = les lignes portent un propriétaire : un acteur de rang
 *    < ADMIN ne peut lire/écrire que SES lignes.
 *
 * SUPER_ADMIN conserve l'accès global (rôle système).
 */

export type DataOp = "read" | "create" | "update" | "delete";

export interface TablePolicy {
  /** Permission requise pour LISTER (null = tout acteur authentifié). */
  read: string | null;
  /** Permission requise pour créer/modifier/supprimer (null = interdit). */
  write: string | null;
  /** Ligne liée à un propriétaire (OWNER_COLUMNS) → accès « own » possible. */
  ownerScoped?: boolean;
}

export const OWNER_COLUMNS: Partial<Record<TableName, string>> = {
  notifications: "user_id",
  ai_conversations: "user_id",
  ai_conversation_messages: "conversation_id", // résolu via ai_conversations.user_id
  ai_documents: "user_id",
  ai_support_plans: "user_id",
  messages: "recipient_id",
  parent_student_links: "parent_user_id",
};

export const TABLE_POLICY: Record<string, TablePolicy> = {
  // ---- Référentiel public (lecture : tout acteur authentifié) ----
  provinces: { read: null, write: PERMISSIONS.SYSTEM_MANAGE },
  establishments: { read: null, write: PERMISSIONS.SCHOOLS_MANAGE_OWN },
  subjects: { read: null, write: PERMISSIONS.SUBJECTS_MANAGE },
  classes: { read: null, write: PERMISSIONS.CLASSES_CREATE },
  events: { read: null, write: PERMISSIONS.ANNOUNCEMENTS_MANAGE },
  announcements: { read: null, write: PERMISSIONS.ANNOUNCEMENTS_MANAGE },
  assignments: { read: null, write: PERMISSIONS.ASSIGNMENTS_MANAGE },
  course_sessions: { read: null, write: PERMISSIONS.CLASSES_UPDATE },

  // ---- Données pédagogiques (lecture scopée, écriture TEACHER+) ----
  students: { read: null, write: null }, // gestion comptes → /api/auth/users
  teachers: { read: PERMISSIONS.USERS_READ, write: null },
  grades: { read: null, write: PERMISSIONS.GRADES_CREATE },
  attendance: { read: null, write: PERMISSIONS.ATTENDANCE_MANAGE },
  attendance_sessions: { read: null, write: PERMISSIONS.ATTENDANCE_MANAGE },
  attendance_qr_records: { read: null, write: PERMISSIONS.ATTENDANCE_MANAGE },
  digital_documents: { read: null, write: PERMISSIONS.DOCUMENTS_MANAGE },

  // ---- Données personnelles (owner-scoped) ----
  notifications: { read: PERMISSIONS.NOTIFICATIONS_READ, write: PERMISSIONS.NOTIFICATIONS_MANAGE, ownerScoped: true },
  messages: { read: PERMISSIONS.COMMUNICATION_USE, write: PERMISSIONS.COMMUNICATION_USE, ownerScoped: true },
  ai_conversations: { read: PERMISSIONS.AI_USE, write: PERMISSIONS.AI_USE, ownerScoped: true },
  ai_conversation_messages: { read: PERMISSIONS.AI_USE, write: PERMISSIONS.AI_USE, ownerScoped: true },
  ai_documents: { read: PERMISSIONS.AI_USE, write: PERMISSIONS.AI_USE, ownerScoped: true },
  ai_support_plans: { read: PERMISSIONS.AI_USE, write: PERMISSIONS.AI_USE, ownerScoped: true },
  parent_student_links: { read: PERMISSIONS.USERS_READ, write: PERMISSIONS.USERS_UPDATE, ownerScoped: true },

  // ---- Données financières / administratives ----
  payments: { read: null, write: PERMISSIONS.PAYMENTS_MANAGE },
  user_roles: { read: PERMISSIONS.USERS_READ, write: PERMISSIONS.USERS_MANAGE_ROLES },
  profiles: { read: PERMISSIONS.USERS_READ, write: PERMISSIONS.USERS_UPDATE },
  teacher_establishment_assignments: { read: PERMISSIONS.USERS_READ, write: PERMISSIONS.USERS_UPDATE },
  teacher_class_assignments: { read: PERMISSIONS.USERS_READ, write: PERMISSIONS.USERS_UPDATE },

  // ---- QR / présence ----
  qr_codes: { read: PERMISSIONS.TOOLS_USE, write: PERMISSIONS.TOOLS_MANAGE },
  qr_scan_history: { read: PERMISSIONS.TOOLS_USE, write: null },

  // ---- Système / automatisation / analytics (ADMIN+) ----
  automation_rules: { read: PERMISSIONS.AUTOMATION_READ, write: PERMISSIONS.AUTOMATION_MANAGE },
  automation_logs: { read: PERMISSIONS.AUTOMATION_READ, write: null },
  analytics_snapshots: { read: PERMISSIONS.ANALYTICS_VIEW_ALL, write: null },
  ai_access_logs: { read: PERMISSIONS.ANALYTICS_VIEW_ALL, write: null },
  ambassadors: { read: PERMISSIONS.AMBASSADOR_MANAGE, write: PERMISSIONS.AMBASSADOR_MANAGE },
  partners: { read: PERMISSIONS.PARTNER_MANAGE, write: PERMISSIONS.PARTNER_MANAGE },
  pilot_programs: { read: PERMISSIONS.PILOT_PROGRAM_MANAGE, write: PERMISSIONS.PILOT_PROGRAM_MANAGE },
};

/** Tables lisibles par tout acteur authentifié même hors scoping personnalisé. */
export const PUBLIC_FALLBACK_READ: ReadonlySet<string> = new Set([
  "provinces", "establishments", "subjects", "classes", "events",
  "announcements", "assignments", "course_sessions", "attendance_sessions",
]);

/** Permission requise pour une opération ; `null` = refusé. */
export function requiredPermission(table: TableName, op: DataOp): string | null {
  const p = TABLE_POLICY[table];
  if (!p) return null;
  if (op === "read") return p.read;
  return p.write;
}

/**
 * Vérifie l'accès en écriture à une LIGNE précise (anti-IDOR) :
 *  • SUPER_ADMIN / ADMIN (rank ≥ ADMIN) : autorisé si la permission passe ;
 *  • sinon, si la table est owner-scoped : uniquement SES propres lignes ;
 *  • sinon : refus.
 */
export function canWriteRow(
  actorRole: string,
  rowOwnerId: unknown,
  actorUserId: string,
): boolean {
  if (roleRank(actorRole) >= roleRank(ROLES.ADMIN)) return true;
  return rowOwnerId != null && String(rowOwnerId) === String(actorUserId);
}

