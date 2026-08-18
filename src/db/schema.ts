import { pgTable, text, integer, numeric, boolean } from "drizzle-orm/pg-core";

/**
 * Schéma EduSync Pro (portage depuis Supabase).
 * Les identifiants sont des chaînes libres (générées côté serveur).
 * Les horodatages sont stockés en ISO 8601 (texte) pour coller au modèle d'origine.
 */

export const provinces = pgTable("provinces", {
  id: text("id").primaryKey(),
  name: text("name"),
  code: text("code"),
  capital: text("capital"),
  created_at: text("created_at"),
});

export const establishments = pgTable("establishments", {
  id: text("id").primaryKey(),
  name: text("name"),
  code: text("code"),
  province_id: text("province_id"),
  city: text("city"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  type: text("type"),
  director_name: text("director_name"),
  school_year: text("school_year"),
  status: text("status"),
  created_at: text("created_at"),
});

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  full_name: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  establishment_id: text("establishment_id"),
});

export const userRoles = pgTable("user_roles", {
  id: text("id").primaryKey(),
  user_id: text("user_id"),
  role: text("role"),
  created_at: text("created_at"),
});

export const classes = pgTable("classes", {
  id: text("id").primaryKey(),
  name: text("name"),
  level: text("level"),
  school_year: text("school_year"),
  capacity: integer("capacity"),
  room: text("room"),
  main_teacher_id: text("main_teacher_id"),
  created_at: text("created_at"),
});

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(),
  name: text("name"),
  code: text("code"),
  coefficient: integer("coefficient"),
  level: text("level"),
  color: text("color"),
  created_at: text("created_at"),
});

export const teachers = pgTable("teachers", {
  id: text("id").primaryKey(),
  first_name: text("first_name"),
  last_name: text("last_name"),
  gender: text("gender"),
  email: text("email"),
  phone: text("phone"),
  subject_names: text("subject_names").array(),
  hire_date: text("hire_date"),
  status: text("status"),
  created_at: text("created_at"),
});

export const students = pgTable("students", {
  id: text("id").primaryKey(),
  first_name: text("first_name"),
  last_name: text("last_name"),
  gender: text("gender"),
  birth_date: text("birth_date"),
  matricule: text("matricule"),
  class_id: text("class_id"),
  parent_name: text("parent_name"),
  parent_phone: text("parent_phone"),
  parent_email: text("parent_email"),
  address: text("address"),
  school_year: text("school_year"),
  status: text("status"),
  created_at: text("created_at"),
});

export const grades = pgTable("grades", {
  id: text("id").primaryKey(),
  student_id: text("student_id"),
  subject_id: text("subject_id"),
  class_id: text("class_id"),
  type: text("type"),
  value: numeric("value"),
  max_value: numeric("max_value"),
  term: text("term"),
  school_year: text("school_year"),
  date: text("date"),
  appreciation: text("appreciation"),
  created_at: text("created_at"),
});

export const attendance = pgTable("attendance", {
  id: text("id").primaryKey(),
  student_id: text("student_id"),
  class_id: text("class_id"),
  date: text("date"),
  status: text("status"),
  reason: text("reason"),
  created_at: text("created_at"),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  student_id: text("student_id"),
  amount: numeric("amount"),
  type: text("type"),
  method: text("method"),
  date: text("date"),
  month: text("month"),
  status: text("status"),
  reference: text("reference"),
  note: text("note"),
  created_at: text("created_at"),
});

export const courseSessions = pgTable("course_sessions", {
  id: text("id").primaryKey(),
  class_id: text("class_id"),
  subject_id: text("subject_id"),
  teacher_id: text("teacher_id"),
  day_of_week: integer("day_of_week"),
  start_time: text("start_time"),
  end_time: text("end_time"),
  room: text("room"),
  created_at: text("created_at"),
});

export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title"),
  body: text("body"),
  audience: text("audience"),
  author_name: text("author_name"),
  priority: text("priority"),
  date: text("date"),
  created_at: text("created_at"),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  sender_name: text("sender_name"),
  recipient_id: text("recipient_id"),
  recipient_type: text("recipient_type"),
  subject: text("subject"),
  body: text("body"),
  status: text("status"),
  date: text("date"),
  created_at: text("created_at"),
});

export const assignments = pgTable("assignments", {
  id: text("id").primaryKey(),
  title: text("title"),
  subject_id: text("subject_id"),
  class_id: text("class_id"),
  description: text("description"),
  due_date: text("due_date"),
  max_score: numeric("max_score"),
  status: text("status"),
  created_at: text("created_at"),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title"),
  type: text("type"),
  start_date: text("start_date"),
  end_date: text("end_date"),
  description: text("description"),
  created_at: text("created_at"),
});

export const qrCodes = pgTable("qr_codes", {
  id: text("id").primaryKey(),
  type: text("type"),
  token: text("token"),
  title: text("title"),
  payload: text("payload"),
  linked_id: text("linked_id"),
  created_at: text("created_at"),
});

export const digitalDocuments = pgTable("digital_documents", {
  id: text("id").primaryKey(),
  title: text("title"),
  type: text("type"),
  student_id: text("student_id"),
  class_id: text("class_id"),
  data: text("data"),
  created_at: text("created_at"),
});

export const attendanceSessions = pgTable("attendance_sessions", {
  id: text("id").primaryKey(),
  class_id: text("class_id"),
  teacher_name: text("teacher_name"),
  date: text("date"),
  qr_token: text("qr_token"),
  status: text("status"),
  created_at: text("created_at"),
});

export const attendanceQrRecords = pgTable("attendance_qr_records", {
  id: text("id").primaryKey(),
  session_id: text("session_id"),
  student_id: text("student_id"),
  scanned_at: text("scanned_at"),
  status: text("status"),
  created_at: text("created_at"),
});

export const qrScanHistory = pgTable("qr_scan_history", {
  id: text("id").primaryKey(),
  token: text("token"),
  type: text("type"),
  result: text("result"),
  created_at: text("created_at"),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updated_at: text("updated_at"),
});

export const appUsers = pgTable("app_users", {
  id: text("id").primaryKey(),
  login_id: text("login_id"),
  password_hash: text("password_hash"),
  full_name: text("full_name"),
  email: text("email"),
  role: text("role"), // SUPER_ADMIN | ADMIN | TEACHER | STUDENT | PARENT … (+ alias legacy)
  status: text("status"), // ACTIVE | DEMO | SUSPENDED | PENDING (+ alias legacy)
  school_id: text("school_id"), // rattachement établissement (ADMIN/TEACHER/STUDENT) ; null pour SUPER_ADMIN
  must_change_password: boolean("must_change_password").default(false), // première connexion → changement obligatoire
  last_login_at: text("last_login_at"), // horodatage de la dernière connexion (audit / affichage)
  created_at: text("created_at"),
  updated_at: text("updated_at"),
});

/**
 * Années académiques — entité de premier niveau, une seule ACTIVE à la fois.
 * Les données métier (classes, élèves, notes…) restent rattachées à leur année via `school_year`.
 */
export const academicYears = pgTable("academic_years", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // ex. « 2026–2027 »
  start_date: text("start_date"),
  end_date: text("end_date"),
  status: text("status").notNull(), // ACTIVE | ARCHIVED | DRAFT
  created_at: text("created_at"),
  updated_at: text("updated_at"),
  created_by: text("created_by"),
});

/** Journal d'audit — toute action sensible (RBAC, comptes, établissements, système). */
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actor_id: text("actor_id"),
  actor_role: text("actor_role"),
  action: text("action"),
  target_id: text("target_id"),
  result: text("result"), // "success" | "denied" | "error"
  metadata: text("metadata"), // JSON sérialisé (jamais de secrets)
  created_at: text("created_at"),
});

/**
 * Sessions sécurisées serveur — chaque session est persistante et RÉVOCABLE.
 * Le jeton HMAC remis au client ne contient que { sid, uid, env, iat, exp } :
 * aucune donnée sensible (jamais de mot de passe, hash, rôle privilégié persistant).
 * Le rôle/statut sont ALWAYS re-vérifiés en base à chaque requête (autorité serveur).
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // session_id opaque (UUID)
  user_id: text("user_id").notNull(),
  environment: text("environment").notNull(), // "demo" | "production"
  issued_at: text("issued_at").notNull(),
  expires_at: text("expires_at").notNull(),
  status: text("status").notNull(), // "active" | "revoked"
  revoked_reason: text("revoked_reason"),
  user_agent: text("user_agent"), // empreinte du client (détection de vol)
  created_at: text("created_at"),
});

/* ====================================================================== *
 *  MODULE 8 — PORTAIL PARENT
 *  Lien explicite élève ↔ compte parent (un parent peut suivre plusieurs enfants).
 * ====================================================================== */

export const parentStudentLinks = pgTable("parent_student_links", {
  id: text("id").primaryKey(),
  parent_user_id: text("parent_user_id").notNull(),
  student_id: text("student_id").notNull(),
  created_at: text("created_at"),
});

/* ====================================================================== *
 *  MODULE 10 — CENTRE DE NOTIFICATIONS
 ====================================================================== */

export const notificationCategories = [
  "SCOLARITE",
  "ABSENCE",
  "NOTE",
  "DEVOIR",
  "MESSAGE",
  "ADMINISTRATION",
  "SYSTEME",
  "ALERT",
] as const;

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(), // destinataire
  category: text("category").notNull(), // SCOLARITE | ABSENCE | NOTE | DEVOIR | MESSAGE | ADMINISTRATION | SYSTEME | ALERT
  title: text("title"),
  body: text("body"),
  priority: text("priority"), // low | normal | high
  read: boolean("read").default(false),
  action_url: text("action_url"), // navigation client quand cliqué
  related_id: text("related_id"), // entité liée
  related_type: text("related_type"), // "grade" | "attendance" | "assignment" | ...
  created_at: text("created_at"),
});

/* ====================================================================== *
 *  MODULE 4 — ASSISTANT ENSEIGNANT (chat IA avec historique)
 *  MODULE 6 — ASSISTANT ADMINISTRATIF
 *  MODULE 7 — ASSISTANT PARENT
 ====================================================================== */

export const aiConversations = pgTable("ai_conversations", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  role: text("role").notNull(), // TEACHER | ADMIN | PARENT | STUDENT
  assistant_type: text("assistant_type").notNull(), // "teacher" | "admin" | "parent"
  model: text("model"),
  provider: text("provider"), // "gemini" | "huggingface" | "local"
  title: text("title"),
  created_at: text("created_at"),
  updated_at: text("updated_at"),
});

export const aiConversationMessages = pgTable("ai_conversation_messages", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id").notNull(),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content"),
  created_at: text("created_at"),
});

/* ====================================================================== *
 *  MODULE 3 — PLAN DE SOUTIEN IA
 ====================================================================== */

export const aiSupportPlans = pgTable("ai_support_plans", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  class_id: text("class_id"),
  title: text("title"),
  content: text("content"), // JSON { objectives, subjects, groups, exercises, recommendations, calendar, tracking }
  status: text("status"), // "draft" | "validated" | "archived"
  created_at: text("created_at"),
  updated_at: text("created_at"),
});

/* ====================================================================== *
 *  MODULE 5 — GÉNÉRATION DE DOCUMENTS
 ====================================================================== */

export const aiDocuments = pgTable("ai_documents", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  title: text("title"),
  type: text("type").notNull(), // "rapport" | "fiche_pedagogique" | "bilan" | "bulletin" | "synthese" | "communication_parent" | "compte_rendu" | "rapport_classe"
  content: text("content"),
  format: text("format"), // "md" | "pdf" | "docx"
  related_student_id: text("related_student_id"),
  related_class_id: text("related_class_id"),
  conversation_id: text("conversation_id"),
  created_at: text("created_at"),
});

/* ====================================================================== *
 *  MODULE 11 — AUTOMATISATION
 ====================================================================== */

export const automationRules = pgTable("automation_rules", {
  id: text("id").primaryKey(),
  name: text("name"),
  description: text("description"),
  trigger: text("trigger"), // "grade_created" | "attendance_recorded" | "assignment_published" | "document_generated"
  condition: text("condition"), // JSON
  action: text("action"), // "notify_parent" | "notify_student" | "notify_teacher" | "notify_admin"
  target_role: text("target_role"),
  enabled: boolean("enabled").default(true),
  created_by: text("created_by"),
  created_at: text("created_at"),
  updated_at: text("updated_at"),
});

export const automationLogs = pgTable("automation_logs", {
  id: text("id").primaryKey(),
  rule_id: text("rule_id"),
  event_type: text("event_type"),
  result: text("result"), // "success" | "error" | "skipped"
  details: text("details"),
  created_at: text("created_at"),
});

/* ====================================================================== *
 *  MODULE 12 — ANALYTICS
 *  (Utilise les tables existantes + table d'historique pour les snapshots)
 ====================================================================== */

export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: text("id").primaryKey(),
  metric: text("metric"), // "average_grade" | "attendance_rate" | "revenue" | "enrollment" | ...
  period: text("period"), // "daily" | "weekly" | "monthly" | "term" | "year"
  value: numeric("value"),
  metadata: text("metadata"), // JSON : classe, matière, établissement
  created_at: text("created_at"),
});

/* ====================================================================== *
 *  MODULE 14 — SYSTÈME D'AMBASSADEURS
 (structure extensible — prête pour l'ajout futur de récompenses)
 ====================================================================== */

export const ambassadors = pgTable("ambassadors", {
  id: text("id").primaryKey(),
  user_id: text("user_id"),
  establishment_id: text("establishment_id"),
  level: text("level"), // "bronze" | "silver" | "gold" | "platinum"
  status: text("status"), // "active" | "inactive" | "suspended"
  activation_date: text("activation_date"),
  stats: text("stats"), // JSON : { usage_count, features_used, ... }
  created_at: text("created_at"),
  updated_at: text("updated_at"),
});

/* ====================================================================== *
 *  MODULE 15 — ÉTABLISSEMENTS PARTENAIRES
 ====================================================================== */

export const partners = pgTable("partners", {
  id: text("id").primaryKey(),
  establishment_id: text("establishment_id"),
  status: text("status"), // "pending" | "active" | "suspended" | "refused"
  integration_date: text("integration_date"),
  public_info: text("public_info"), // JSON : { description, logo_url, website, ... }
  stats: text("stats"), // JSON
  consent_given: boolean("consent_given").default(false),
  created_at: text("created_at"),
  updated_at: text("updated_at"),
});

/* ====================================================================== *
 *  MODULE 16 — PROGRAMME PILOTE
 ====================================================================== */

export const pilotPrograms = pgTable("pilot_programs", {
  id: text("id").primaryKey(),
  establishment_id: text("establishment_id"),
  status: text("status"), // "pilot" | "active" | "suspended" | "archived"
  start_date: text("start_date"),
  end_date: text("end_date"),
  config: text("config"), // JSON : modules activés, features, ...
  created_at: text("created_at"),
  updated_at: text("updated_at"),
});

/* ====================================================================== *
 *  MODULE 19 — SÉCURITÉ IA
 *  Journal des accès IA (audit trail des requêtes IA avec contrôle permissions)
 ====================================================================== */

export const aiAccessLogs = pgTable("ai_access_logs", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  role: text("role").notNull(),
  resource: text("resource"), // "grades" | "attendance" | "students" | "analysis" | "chat" | "documents"
  action: text("action"), // "analyze_class" | "chat" | "generate_document" | "generate_plan"
  permission: text("permission"), // permission vérifiée
  granted: boolean("granted").default(true),
  created_at: text("created_at"),
});
