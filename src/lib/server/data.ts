import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  provinces,
  establishments,
  profiles,
  userRoles,
  classes,
  subjects,
  teachers,
  students,
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
  teachers: ["id", "first_name", "last_name", "gender", "email", "phone", "subject_names", "hire_date", "status", "created_at"],
  students: ["id", "first_name", "last_name", "gender", "birth_date", "matricule", "class_id", "parent_name", "parent_phone", "parent_email", "address", "school_year", "status", "created_at"],
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
  const safeLimit = Math.min(Number(limit) || 2000, 10000);
  const rows = (await db
    .select()
    .from(t as never)
    .orderBy(sql.raw(`"${orderCol}" ${dir} NULLS ${nulls}`))
    .limit(safeLimit)) as unknown as Record<string, unknown>[];
  return coerceOnRead(table, rows);
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

export async function countRows(table: TableName) {
  const t = REGISTRY[table];
  const rows = (await db.select({ c: sql`count(*)::int` }).from(t as never)) as unknown as { c: number }[];
  return rows[0]?.c ?? 0;
}

export async function wipeTable(table: TableName) {
  const t = REGISTRY[table];
  await db.delete(t as never);
}
