export type Student = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string | null;
  matricule: string | null;
  class_id: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  address: string | null;
  school_year: string;
  status: string;
  created_at: string;
};

export type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  email: string | null;
  phone: string | null;
  subject_names: string[];
  hire_date: string | null;
  status: string;
  created_at: string;
};

export type SchoolClass = {
  id: string;
  name: string;
  level: string;
  school_year: string;
  capacity: number;
  room: string | null;
  main_teacher_id: string | null;
  created_at: string;
};

export type Subject = {
  id: string;
  name: string;
  code: string | null;
  coefficient: number;
  level: string | null;
  color: string;
  created_at: string;
};

export type Grade = {
  id: string;
  student_id: string;
  subject_id: string;
  class_id: string | null;
  type: string;
  value: number;
  max_value: number;
  term: string;
  school_year: string;
  date: string;
  appreciation: string | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  student_id: string;
  class_id: string | null;
  date: string;
  status: string;
  reason: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  student_id: string;
  amount: number;
  type: string;
  method: string;
  date: string;
  month: string | null;
  status: string;
  reference: string | null;
  note: string | null;
  created_at: string;
};

export type CourseSession = {
  id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  author_name: string | null;
  priority: string;
  date: string;
  created_at: string;
};

export type Message = {
  id: string;
  sender_name: string;
  recipient_id: string;
  recipient_type: string;
  subject: string;
  body: string;
  status: string;
  date: string;
  created_at: string;
};

export type Assignment = {
  id: string;
  title: string;
  subject_id: string | null;
  class_id: string | null;
  description: string | null;
  due_date: string | null;
  max_score: number;
  status: string;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  type: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
  created_at: string;
};

export type AttendanceSession = {
  id: string;
  class_id: string;
  teacher_name: string | null;
  date: string;
  qr_token: string;
  status: string;
  created_at: string;
};

export type QrCodeRecord = {
  id: string;
  type: string;
  token: string;
  title: string;
  payload: string | null;
  linked_id: string | null;
  created_at: string;
};

export type DigitalDocument = {
  id: string;
  title: string;
  type: string;
  student_id: string | null;
  class_id: string | null;
  data: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  establishment_id: string | null;
};

export type Province = {
  id: string;
  name: string;
  code: string;
  capital: string | null;
  created_at: string;
};

export type Establishment = {
  id: string;
  name: string;
  code: string | null;
  province_id: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  type: string;
  director_name: string | null;
  school_year: string;
  status: string;
  created_at: string;
};

export const ESTABLISHMENT_TYPES: Record<string, string> = {
  primaire: "Primaire",
  secondaire: "Secondaire",
  mixte: "Primaire & secondaire",
  superieur: "Superieur",
};

export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "PARENT"
  | "super_admin"
  | "admin"
  | "enseignant"
  | "eleve"
  | "parent";

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super administrateur",
  ADMIN: "Administrateur",
  TEACHER: "Enseignant",
  STUDENT: "Élève",
  PARENT: "Parent",
  super_admin: "Super administrateur",
  admin: "Administrateur",
  enseignant: "Enseignant",
  eleve: "Élève",
  parent: "Parent",
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  DEMO: "Démo",
  SUSPENDED: "Suspendu",
  PENDING: "En attente",
};

/** Permissions RBAC côté client (pour le filtrage de l'UI — la vérité reste serveur). */
export const PERM = {
  DASHBOARD_VIEW: "dashboard.view",
  PROFILE_EDIT: "profile.edit",
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  USERS_MANAGE_ROLES: "users.manage_roles",
  CLASSES_READ: "classes.read",
  CLASSES_CREATE: "classes.create",
  CLASSES_UPDATE: "classes.update",
  CLASSES_DELETE: "classes.delete",
  GRADES_READ: "grades.read",
  GRADES_CREATE: "grades.create",
  GRADES_UPDATE: "grades.update",
  SUBJECTS_READ: "subjects.read",
  SUBJECTS_MANAGE: "subjects.manage",
  ATTENDANCE_READ: "attendance.read",
  ATTENDANCE_MANAGE: "attendance.manage",
  PAYMENTS_READ: "payments.read",
  PAYMENTS_MANAGE: "payments.manage",
  SCHOOLS_READ: "schools.read",
  SCHOOLS_MANAGE_OWN: "schools.manage_own",
  SCHOOLS_MANAGE_ALL: "schools.manage_all",
  COMMUNICATION_USE: "communication.use",
  ANNOUNCEMENTS_MANAGE: "announcements.manage",
  AI_USE: "ai.use",
  AI_CONFIGURE: "ai.configure",
  AI_CLASS_ANALYSIS: "ai.class_analysis",
  AI_ASSISTANT_USE: "ai.assistant_use",
  AI_SUPPORT_PLAN: "ai.support_plan",
  AI_DOCUMENT_GENERATE: "ai.document_generate",
  DOCUMENTS_READ: "documents.read",
  DOCUMENTS_MANAGE: "documents.manage",
  DOCUMENTS_GENERATE: "documents.generate",
  NOTIFICATIONS_READ: "notifications.read",
  NOTIFICATIONS_MANAGE: "notifications.manage",
  AUTOMATION_MANAGE: "automation.manage",
  AUTOMATION_READ: "automation.read",
  ANALYTICS_VIEW: "analytics.view",
  ANALYTICS_VIEW_ALL: "analytics.view_all",
  AMBASSADOR_MANAGE: "ambassador.manage",
  PARTNER_MANAGE: "partner.manage",
  PILOT_PROGRAM_MANAGE: "pilot_program.manage",
  MODULES_MANAGE: "modules.manage",
  PLUGINS_MANAGE: "plugins.manage",
  SYSTEM_CONFIGURE: "system.configure",
  SYSTEM_MANAGE: "system.manage",
  ACADEMIC_YEAR_READ: "academic_year.read",
  ACADEMIC_YEAR_MANAGE: "academic_year.manage",
  AUDIT_READ: "audit.read",
} as const;

export type UserRole = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
};

export type AppUser = {
  id: string;
  login_id: string;
  full_name: string;
  email?: string | null;
  school_id?: string | null;
  school_name?: string | null;
  last_login_at?: string | null;
  role: AppRole;
  status: string;
  created_at: string;
};

export type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  created_at: string | null;
};

/* ====================================================================== *
 *  MODULE 10 — Notifications
 * ====================================================================== */

export type Notification = {
  id: string;
  user_id: string;
  category: string;
  title: string | null;
  body: string | null;
  priority: string | null;
  read: boolean;
  action_url: string | null;
  related_id: string | null;
  related_type: string | null;
  created_at: string;
};

export const NOTIFICATION_CATEGORIES: Record<string, string> = {
  SCOLARITE: "Scolarité",
  ABSENCE: "Absence",
  NOTE: "Note",
  DEVOIR: "Devoir",
  MESSAGE: "Message",
  ADMINISTRATION: "Administration",
  SYSTEME: "Système",
  ALERT: "Alerte",
};

export const NOTIFICATION_PRIORITIES: Record<string, string> = {
  low: "Faible",
  normal: "Normal",
  high: "Élevée",
};

/* ====================================================================== *
 *  MODULE 4, 6, 7 — Assistants IA
 * ====================================================================== */

export type AIConversation = {
  id: string;
  user_id: string;
  role: string;
  assistant_type: string; // "teacher" | "admin" | "parent"
  model: string | null;
  provider: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type AIConversationMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string | null;
  created_at: string;
};

/* ====================================================================== *
 *  MODULE 3 — Plan de soutien IA
 * ====================================================================== */

export interface SupportPlanContent {
  objectives: string[];
  subjects: string[];
  groups: string[];
  exercises: string[];
  recommendations: string[];
  calendar: string[];
  tracking: string[];
}

export type AISupportPlan = {
  id: string;
  user_id: string;
  class_id: string | null;
  title: string | null;
  content: string; // JSON
  status: string;
  created_at: string;
  updated_at: string;
};

/* ====================================================================== *
 *  MODULE 5 — Documents générés par IA
 * ====================================================================== */

export type AIDocument = {
  id: string;
  user_id: string;
  title: string | null;
  type: string;
  content: string | null;
  format: string | null;
  related_student_id: string | null;
  related_class_id: string | null;
  conversation_id: string | null;
  created_at: string;
};

export const DOCUMENT_TYPES: Record<string, string> = {
  rapport: "Rapport",
  fiche_pedagogique: "Fiche pédagogique",
  bilan: "Bilan",
  bulletin: "Bulletin",
  synthese: "Synthèse",
  communication_parent: "Communication parent",
  compte_rendu: "Compte rendu",
  rapport_classe: "Rapport de classe",
};

/* ====================================================================== *
 *  MODULE 11 — Automatisation
 * ====================================================================== */

export type AutomationRule = {
  id: string;
  name: string | null;
  description: string | null;
  trigger: string | null;
  condition: string | null;
  action: string | null;
  target_role: string | null;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationLog = {
  id: string;
  rule_id: string | null;
  event_type: string | null;
  result: string | null;
  details: string | null;
  created_at: string;
};

/* ====================================================================== *
 *  MODULE 12 — Analytics
 * ====================================================================== */

export type AnalyticsSnapshot = {
  id: string;
  metric: string | null;
  period: string | null;
  value: number;
  metadata: string | null;
  created_at: string;
};

/* ====================================================================== *
 *  MODULE 14 — Ambassadeurs
 * ====================================================================== */

export type Ambassador = {
  id: string;
  user_id: string | null;
  establishment_id: string | null;
  level: string | null;
  status: string | null;
  activation_date: string | null;
  stats: string | null;
  created_at: string;
  updated_at: string;
};

export const AMBASSADOR_LEVELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Argent",
  gold: "Or",
  platinum: "Platine",
};

/* ====================================================================== *
 *  MODULE 15 — Partenaires
 * ====================================================================== */

export type Partner = {
  id: string;
  establishment_id: string | null;
  status: string | null;
  integration_date: string | null;
  public_info: string | null;
  stats: string | null;
  consent_given: boolean;
  created_at: string;
  updated_at: string;
};

/* ====================================================================== *
 *  MODULE 16 — Programme pilote
 * ====================================================================== */

export type PilotProgram = {
  id: string;
  establishment_id: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  config: string | null;
  created_at: string;
  updated_at: string;
};

export const PILOT_STATUSES: Record<string, string> = {
  pilot: "Programme pilote",
  active: "Actif",
  suspended: "Suspendu",
  archived: "Archivé",
};

export const GRADE_TYPES: Record<string, string> = {
  controle: "Contrôle",
  devoir: "Devoir",
  composition: "Composition",
  examen: "Examen",
  rattrapage: "Rattrapage",
};

export const TERMS: Record<string, string> = {
  P1: "Palier 1",
  P2: "Palier 2",
  P3: "Palier 3",
  P4: "Palier 4",
  P5: "Palier 5",
  T1: "Trimestre 1",
  T2: "Trimestre 2",
  T3: "Trimestre 3",
};

export const PRIMARY_TERMS = ["P1", "P2", "P3", "P4", "P5"];
export const SECONDARY_TERMS = ["T1", "T2", "T3"];
export const TERM_KEYS = [...PRIMARY_TERMS, ...SECONDARY_TERMS];

export function termLabel(term: string) {
  return TERMS[term] ?? term;
}

export const ATTENDANCE_STATUS: Record<string, string> = {
  present: "Présent",
  absent: "Absent",
  retard: "Retard",
  excuse: "Excusé",
};

export const PAYMENT_TYPES: Record<string, string> = {
  scolarite: "Scolarité",
  inscription: "Inscription",
  cantine: "Cantine",
  transport: "Transport",
  fournitures: "Fournitures",
  autre: "Autre",
};

export const PAYMENT_METHODS: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  virement: "Virement",
  cheque: "Chèque",
};

export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export const ANNOUNCEMENT_AUDIENCES: Record<string, string> = {
  all: "Tout le monde",
  teachers: "Enseignants",
  students: "Élèves",
  parents: "Parents",
};

export const EVENT_TYPES: Record<string, string> = {
  examen: "Examen",
  ferie: "Jour férié",
  reunion: "Réunion",
  conges: "Congés",
  event: "Événement",
  sortie: "Sortie",
};

export const SCHOOL_YEAR = "2025-2026";

export function fullName(p: { first_name: string; last_name: string }) {
  return `${p.last_name.toUpperCase()} ${p.first_name}`;
}

export function initials(p: { first_name: string; last_name: string }) {
  return `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase();
}

export function average(grades: { value: number; max_value: number }[]) {
  if (!grades.length) return 0;
  return grades.reduce((sum, g) => sum + (g.value / (g.max_value || 20)) * 20, 0) / grades.length;
}

export function formatMoney(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value))} FCFA`;
}

export function mention(avg: number) {
  if (avg >= 16) return "Excellent";
  if (avg >= 14) return "Très bien";
  if (avg >= 12) return "Bien";
  if (avg >= 10) return "Assez bien";
  if (avg >= 8) return "Insuffisant";
  return "Faible";
}
