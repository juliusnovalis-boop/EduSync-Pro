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
  superieur: "Supérieur",
};

/** Rôles officiels (canoniques) + alias legacy (compatibilité ascendante). */
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
  // alias legacy
  super_admin: "Super administrateur",
  admin: "Administrateur",
  enseignant: "Enseignant",
  eleve: "Élève",
  parent: "Parent",
};

/** Statuts de compte (DEMO vs PRODUCTION). */
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
  DOCUMENTS_READ: "documents.read",
  DOCUMENTS_MANAGE: "documents.manage",
  MODULES_MANAGE: "modules.manage",
  PLUGINS_MANAGE: "plugins.manage",
  SYSTEM_CONFIGURE: "system.configure",
  SYSTEM_MANAGE: "system.manage",
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
