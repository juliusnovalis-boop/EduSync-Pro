import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { OWNER_COLUMNS, requiredPermission } from "./data-policy";
import { ROLES, roleRank } from "./rbac";
import {
  provinces,
  establishments,
  profiles,
  userRoles,
  classes,
  subjects,
  teachers,
  students,
  appUsers,
  grades,
  attendance,
  payments,
  courseSessions,
  announcements,
  messages,
  assignments,
  events,
  qrCodes,
  digitalDocuments,
  attendanceSessions,
  attendanceQrRecords,
  qrScanHistory,
    parentStudentLinks,
  teacherEstablishmentAssignments,
  teacherClassAssignments,
  notifications,
  aiConversations,
  aiConversationMessages,
  aiSupportPlans,
  aiDocuments,
  automationRules,
  automationLogs,
  analyticsSnapshots,
  ambassadors,
  partners,
  pilotPrograms,
  aiAccessLogs,
} from "@/db/schema";

/**
 * Couche d'accès aux données — API générique de type « table »
 * (liste / création / édition / suppression) au-dessus de Drizzle + PostgreSQL.
 */

export type TableName = keyof typeof REGISTRY;

export const TABLES: Record<string, string[]> = {
  provinces: ["id", "name", "code", "capital", "created_at"],
  establishments: ["id", "name", "code", "province_id", "city", "address", "phone", "email", "type", "director_name", "school_year", "status", "created_at"],
  profiles: ["id", "full_name", "email", "phone", "establishment_id"],
  user_roles: ["id", "user_id", "role", "created_at"],
  classes: ["id", "name", "level", "school_year", "capacity", "room", "main_teacher_id", "created_at"],
  subjects: ["id", "name", "code", "coefficient", "level", "color", "created_at"],
    teachers: ["id", "first_name", "last_name", "gender", "email", "phone", "user_id", "subject_names", "hire_date", "status", "created_at"],
  students: ["id", "first_name", "last_name", "gender", "birth_date", "matricule", "class_id", "user_id", "parent_name", "parent_phone", "parent_email", "address", "school_year", "status", "created_at"],
  grades: ["id", "student_id", "subject_id", "class_id", "type", "value", "max_value", "term", "school_year", "date", "appreciation", "created_at"],
  attendance: ["id", "student_id", "class_id", "date", "status", "reason", "created_at"],
  payments: ["id", "student_id", "amount", "type", "method", "date", "month", "status", "reference", "note", "created_at"],
  course_sessions: ["id", "class_id", "subject_id", "teacher_id", "day_of_week", "start_time", "end_time", "room", "created_at"],
  announcements: ["id", "title", "body", "audience", "author_name", "priority", "date", "created_at"],
  messages: ["id", "sender_name", "recipient_id", "recipient_type", "subject", "body", "status", "date", "created_at"],
  assignments: ["id", "title", "subject_id", "class_id", "description", "due_date", "max_score", "status", "created_at"],
  events: ["id", "title", "type", "start_date", "end_date", "description", "created_at"],
  qr_codes: ["id", "type", "token", "title", "payload", "linked_id", "created_at"],
  digital_documents: ["id", "title", "type", "student_id", "class_id", "data", "created_at"],
  attendance_sessions: ["id", "class_id", "teacher_name", "date", "qr_token", "status", "created_at"],
  attendance_qr_records: ["id", "session_id", "student_id", "scanned_at", "status", "created_at"],
  qr_scan_history: ["id", "token", "type", "result", "created_at"],
    parent_student_links: ["id", "parent_user_id", "student_id", "created_at"],
  teacher_establishment_assignments: ["id", "teacher_id", "establishment_id", "status", "created_at"],
  teacher_class_assignments: ["id", "teacher_id", "class_id", "subject_id", "school_year", "status", "created_at"],
  notifications: ["id", "user_id", "category", "title", "body", "priority", "read", "action_url", "related_id", "related_type", "created_at"],
  ai_conversations: ["id", "user_id", "role", "assistant_type", "model", "provider", "title", "created_at", "updated_at"],
  ai_conversation_messages: ["id", "conversation_id", "role", "content", "created_at"],
  ai_support_plans: ["id", "user_id", "class_id", "title", "content", "status", "created_at", "updated_at"],
  ai_documents: ["id", "user_id", "title", "type", "content", "format", "related_student_id", "related_class_id", "conversation_id", "created_at"],
  automation_rules: ["id", "name", "description", "trigger", "condition", "action", "target_role", "enabled", "created_by", "created_at", "updated_at"],
  automation_logs: ["id", "rule_id", "event_type", "result", "details", "created_at"],
  analytics_snapshots: ["id", "metric", "period", "value", "metadata", "created_at"],
  ambassadors: ["id", "user_id", "establishment_id", "level", "status", "activation_date", "stats", "created_at", "updated_at"],
  partners: ["id", "establishment_id", "status", "integration_date", "public_info", "stats", "consent_given", "created_at", "updated_at"],
  pilot_programs: ["id", "establishment_id", "status", "start_date", "end_date", "config", "created_at", "updated_at"],
  ai_access_logs: ["id", "user_id", "role", "resource", "action", "permission", "granted", "created_at"],
};

const NUMERIC: Record<string, string[]> = {
  classes: ["capacity"],
  subjects: ["coefficient"],
  grades: ["value", "max_value"],
  payments: ["amount"],
  course_sessions: ["day_of_week"],
  assignments: ["max_score"],
  analytics_snapshots: ["value"],
};

const ARRAY: Record<string, string[]> = {
  teachers: ["subject_names"],
};

const REGISTRY = {
  provinces,
  establishments,
  profiles,
  user_roles: userRoles,
  classes,
  subjects,
  teachers,
  students,
  appUsers,
  grades,
  attendance,
  payments,
  course_sessions: courseSessions,
  announcements,
  messages,
  assignments,
  events,
  qr_codes: qrCodes,
  digital_documents: digitalDocuments,
  attendance_sessions: attendanceSessions,
  attendance_qr_records: attendanceQrRecords,
  qr_scan_history: qrScanHistory,
    parent_student_links: parentStudentLinks,
  teacher_establishment_assignments: teacherEstablishmentAssignments,
  teacher_class_assignments: teacherClassAssignments,
  notifications,
  ai_conversations: aiConversations,
  ai_conversation_messages: aiConversationMessages,
  ai_support_plans: aiSupportPlans,
  ai_documents: aiDocuments,
  automation_rules: automationRules,
  automation_logs: automationLogs,
  analytics_snapshots: analyticsSnapshots,
  ambassadors,
  partners,
  pilot_programs: pilotPrograms,
  ai_access_logs: aiAccessLogs,
};

export function isTableName(value: string): value is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, value);
}

export function assertTable(value: string): TableName {
  if (!isTableName(value)) throw new Error(`Table inconnue : ${value}`);
  return value;
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanValues(table: string, values: Record<string, unknown> | null | undefined) {
  const allowed = new Set(TABLES[table]);
  const numCols = NUMERIC[table] ?? [];
  const arrCols = ARRAY[table] ?? [];
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(values ?? {})) {
    if (!allowed.has(key)) continue;
    let v = values![key];
    if (v === "") v = null;
    if (arrCols.includes(key)) {
      if (v == null) v = null;
      else if (Array.isArray(v)) v = (v as unknown[]).map(String);
      else v = String(v).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (numCols.includes(key) && v !== null && v !== undefined) {
      v = Number(v);
      if (Number.isNaN(v as number)) v = null;
    }
    out[key] = v;
  }
  // L'identifiant et la date de création sont gérés côté serveur.
  delete out.id;
  delete out.created_at;
  return out;
}

function coerceOnRead(table: string, rows: Record<string, unknown>[]) {
  const numCols = NUMERIC[table] ?? [];
  if (!numCols.length) return rows;
  return rows.map((row) => {
    const out = { ...row };
    for (const c of numCols) {
      if (out[c] !== null && out[c] !== undefined) out[c] = Number(out[c]);
    }
    return out;
  });
}

type Options = { order?: string; ascending?: boolean; limit?: number };

export async function listRows(table: TableName, options: Options = {}) {
  const { order = "created_at", ascending = false, limit = 2000 } = options;
  const t = REGISTRY[table];
  const allowed = TABLES[table];
  const orderCol = allowed.includes(order) ? order : "created_at";
  const dir = ascending ? "ASC" : "DESC";
  const nulls = ascending ? "FIRST" : "LAST";
  // F-22 : plafond dur interne (l'API est en plus bornée à MAX_LIST_LIMIT).
  const safeLimit = Math.min(Number(limit) || 2000, LIST_HARD_CAP);
  const rows = (await db
    .select()
    .from(t as never)
    .orderBy(sql.raw(`"${orderCol}" ${dir} NULLS ${nulls}`))
    .limit(safeLimit)) as unknown as Record<string, unknown>[];
  return coerceOnRead(table, rows);
}

/**
 * F-22 (pentest #2) — Plafond dur de lecture, appliqué au niveau du moteur de
 * données (en complément du plafond d'API). Aucun appelant, même interne, ne
 * peut demander l'extraction illimitée d'une table.
 */
const LIST_HARD_CAP = 5000;

/**
 * Périmètre de lecture par rôle (modèle multi-établissements).
 * - TEACHER : uniquement les élèves/classes de SES affectations
 *   (teacher_class_assignments) — jamais toutes les classes de l'établissement.
 * - PARENT : uniquement SES enfants (parent_student_links), quel que soit
 *   l'établissement de l'enfant (parent multi-écoles autorisé).
 * - STUDENT : uniquement sa propre fiche et ses propres données.
 * - ADMIN / SUPER_ADMIN : pas de filtrage supplémentaire (RBAC existant).
 * Le schoolId de session reste le contexte actif ; il n'est PAS utilisé pour
 * couper la relation parent multi-écoles.
 *
 * F-7 (pentest #2) — ordre de décision STRICT et DENY BY DEFAULT :
 *   0. aucun acteur           → aucune ligne ;
 *   1. ADMIN+                 → règles RBAC/matrice seules ;
 *   2. table owner-scoped     → uniquement SES lignes (propriété de ligne) ;
 *   3. TEACHER/PARENT/STUDENT → périmètre explicite ci-dessous ;
 *   4. toute autre combinaison→ refus (sauf table `read: null`).
 */
export async function scopeRowsForActor(
  table: TableName,
  rows: Record<string, unknown>[],
  actor: { role: string; userId: string } | null,
): Promise<Record<string, unknown>[]> {
  // F-7 : aucun acteur identifié → AUCUNE donnée (deny by default).
  if (!actor) return [];

  // 1) ADMIN / SUPER_ADMIN : le RBAC et la matrice par table font foi.
  if (roleRank(actor.role) >= roleRank(ROLES.ADMIN)) return rows;

  // 2) PROPRIÉTÉ DE LIGNE — prioritaire sur toute autre règle. Avant ce
  // correctif, la propriété n'était vérifiée qu'en écriture (canWriteRow) :
  // un PARENT/STUDENT pouvait donc LISTER les notifications, messages et
  // conversations IA de n'importe quel autre utilisateur (IDOR en lecture).
  const ownerCol = OWNER_COLUMNS[table];
  if (ownerCol) {
    if (ownerCol === "conversation_id") {
      // ai_conversation_messages : la propriété est celle de la conversation.
      const owned = (await db
        .select({ id: aiConversations.id })
        .from(aiConversations as never)
        .where(eq(aiConversations.user_id, actor.userId))) as unknown as { id: string }[];
      const ownedIds = new Set(owned.map((c) => String(c.id)));
      return rows.filter((r) => ownedIds.has(String(r.conversation_id)));
    }
    return rows.filter((r) => r[ownerCol] != null && String(r[ownerCol]) === String(actor.userId));
  }

  /**
   * F-7 — REPLI EXPLICITE ET BORNÉ.
   * L'ancien code terminait par `return rows` : toute combinaison rôle/table
   * non prévue renvoyait l'INTÉGRALITÉ de la table. Désormais, seules les
   * tables que la matrice déclare lisibles par tout acteur authentifié
   * (`read: null`) passent ; toute autre combinaison est REFUSÉE (tableau vide).
   */
  const publicRead = requiredPermission(table, "read") === null;

  if (actor.role === "TEACHER") {
    if (table !== "students" && table !== "classes") return publicRead ? rows : [];
    const prof = (await db.select().from(teachers as never).where(eq(teachers.user_id, actor.userId)).limit(1)) as unknown as { id: string }[];
    if (!prof.length) return [];
    const ca = (await db
      .select()
      .from(teacherClassAssignments as never)
      .where(eq(teacherClassAssignments.teacher_id, prof[0].id))) as unknown as { class_id: string | null }[];
    const classIds = new Set(ca.map((a) => a.class_id).filter(Boolean).map(String));
    if (table === "classes") return rows.filter((r) => classIds.has(String(r.id)));
    return rows.filter((r) => classIds.has(String(r.class_id)));
  }

  if (actor.role === "PARENT") {
    const scopedTables = ["students", "grades", "attendance", "payments", "digital_documents", "attendance_qr_records"];
    if (!scopedTables.includes(table)) return publicRead ? rows : [];
    const links = (await db
      .select()
      .from(parentStudentLinks as never)
      .where(eq(parentStudentLinks.parent_user_id, actor.userId))) as unknown as { student_id: string }[];
    const ids = new Set(links.map((l) => l.student_id));
    if (table === "students") return rows.filter((r) => ids.has(String(r.id)));
    return rows.filter((r) => ids.has(String(r.student_id)));
  }

  if (actor.role === "STUDENT") {
    if (table === "students") return rows.filter((r) => r.user_id === actor.userId);
    const ownDataTables = ["grades", "attendance", "payments", "digital_documents", "attendance_qr_records"];
    if (ownDataTables.includes(table)) {
      const me = (await db.select().from(students as never).where(eq(students.user_id, actor.userId)).limit(1)) as unknown as { id: string }[];
      if (!me.length) return [];
      return rows.filter((r) => String(r.student_id) === me[0].id);
    }
    // Annonces, devoirs, emploi du temps, référentiels : lecture pédagogique.
    return publicRead ? rows : [];
  }

  // Rôle non reconnu → aucune donnée (deny by default).
  return [];
}
/**
 * Enrichit les fiches métier (students / teachers) avec les données du compte
 * app_users associé : login_id, statut du compte, email.
 * La liaison est la relation réelle user_id -> app_users.id (jamais le nom).
 * Si user_id est NULL, la fiche est laissée inchangée (pas de compte inventé).
 */
export async function attachAccountInfo(
  table: TableName,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  if (table !== "students" && table !== "teachers") return rows;
  const ids = rows
    .map((r) => r.user_id)
    .filter((v): v is string => !!v && typeof v === "string");
  if (!ids.length) return rows;
  const uniq = [...new Set(ids)];
  const accts = (await db
    .select({
      id: appUsers.id,
      login_id: appUsers.login_id,
      status: appUsers.status,
      email: appUsers.email,
    })
    .from(appUsers)
    .where(sql`${appUsers.id} IN (${sql.join(uniq.map((u) => sql`${u}`), sql`, `)})`)) as unknown as {
    id: string; login_id: string | null; status: string | null; email: string | null;
  }[];
  const byId = new Map(accts.map((a) => [a.id, a]));
  return rows.map((r) => {
    if (!r.user_id) return r;
    const a = byId.get(String(r.user_id));
    if (!a) return { ...r, account_exists: false, login_id: null, account_status: null };
    return { ...r, account_exists: true, login_id: a.login_id, account_status: a.status, account_email: a.email };
  });
}
export async function createRow(table: TableName, values: Record<string, unknown>) {
  const t = REGISTRY[table];
  const payload = { ...cleanValues(table, values), id: newId(), created_at: new Date().toISOString() };
  const rows = (await db.insert(t as never).values(payload as never).returning()) as unknown as Record<string, unknown>[];
  return coerceOnRead(table, rows)[0];
}

export async function bulkInsert(table: TableName, rowsInput: Record<string, unknown>[], upsert = false) {
  const t = REGISTRY[table];
  const now = new Date().toISOString();
  const payload = (rowsInput ?? []).map((r) => ({
    ...cleanValues(table, r),
    id: typeof r.id === "string" && r.id ? r.id : newId(),
    created_at: now,
  }));
  if (payload.length === 0) return { inserted: 0 };
  const query = db.insert(t as never).values(payload as never);
  if (upsert) {
    const setCols = Object.keys(payload[0]).filter((k) => k !== "id");
    (query as never as { onConflictDoUpdate: (cfg: unknown) => unknown }).onConflictDoUpdate({
      target: (t as never as { id: unknown }).id,
      set: Object.fromEntries(setCols.map((k) => [k, sql.raw(`EXCLUDED."${k}"`)])),
    });
  }
  const returning = (await query.returning({ id: sql`1` })) as unknown[];
  return { inserted: returning.length };
}

export async function updateRow(table: TableName, id: string, values: Record<string, unknown>) {
  const t = REGISTRY[table];
  const payload = cleanValues(table, values);
  const rows = (await db
    .update(t as never)
    .set(payload as never)
    .where(sql`"id" = ${id}`)
    .returning()) as unknown as Record<string, unknown>[];
  if (!rows.length) return null;
  return coerceOnRead(table, rows)[0];
}

export async function deleteRow(table: TableName, id: string) {
  const t = REGISTRY[table];
  const rows = (await db
    .delete(t as never)
    .where(sql`"id" = ${id}`)
    .returning({ id: sql`1` })) as unknown[];
  return rows.length > 0;
}

/**
 * F-7 (pentest #2) — Résolution du PROPRIÉTAIRE d'une ligne, pour l'anti-IDOR
 * des routes génériques PUT/DELETE. Renvoie `exists: false` si la ligne
 * n'existe pas (→ 404), sinon `ownerId` (valeur de la colonne propriétaire,
 * ou `null` si la table n'est pas owner-scoped / la colonne est vide).
 *
 * `ai_conversation_messages` n'a pas de colonne `user_id` : son propriétaire
 * est celui de la conversation parente (résolu ici).
 */
export async function getRowOwnerId(
  table: TableName,
  id: string,
  ownerColumn: string | undefined,
): Promise<{ exists: boolean; ownerId: unknown }> {
  const t = REGISTRY[table];
  const rows = (await db
    .select()
    .from(t as never)
    .where(sql`"id" = ${id}`)
    .limit(1)) as unknown as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return { exists: false, ownerId: null };
  if (!ownerColumn) return { exists: true, ownerId: null };
  let ownerId: unknown = row[ownerColumn];
  if (ownerColumn === "conversation_id") {
    const conv = (await db
      .select()
      .from(REGISTRY.ai_conversations as never)
      .where(sql`"id" = ${String(ownerId ?? "")}`)
      .limit(1)) as unknown as Record<string, unknown>[];
    ownerId = conv[0]?.user_id ?? null;
  }
  return { exists: true, ownerId };
}

export async function countRows(table: TableName) {
  const t = REGISTRY[table];
  const rows = (await db.select({ c: sql`count(*)::int` }).from(t as never)) as unknown as { c: number }[];
  return rows[0]?.c ?? 0;
}

export async function wipeTable(table: TableName) {
  const t = REGISTRY[table];
  await db.delete(t as never);
}
