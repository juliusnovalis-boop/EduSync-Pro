/**
 * RBAC EduSync Pro — couche centralisée de rôles & permissions.
 *
 * Rôles officiels : SUPER_ADMIN > ADMIN > TEACHER > STUDENT > PARENT (hiérarchie cumulative).
 * Les permissions sont cumulatives (TEACHER hérite de STUDENT, ADMIN de TEACHER...).
 * Conçu pour ajouter de nouveaux rôles (DIRECTOR, ACCOUNTANT...) SANS réécrire.
 *
 * La sécurité ne repose JAMAIS sur l'UI : `can()` est la source de vérité,
 * vérifiée côté serveur par `requirePermission()` (lib/server/auth.ts).
 */

/* ------------------------------- Rôles -------------------------------- */

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Alias legacy -> rôle canonique (compatibilité ascendante, aucune donnée cassée). */
const ROLE_ALIASES: Record<string, Role> = {
  super_admin: ROLES.SUPER_ADMIN,
  admin: ROLES.ADMIN,
  enseignant: ROLES.TEACHER,
  eleve: ROLES.STUDENT,
  parent: ROLES.PARENT,
  directeur: ROLES.ADMIN,
  student: ROLES.STUDENT,
  teacher: ROLES.TEACHER,
  superadmin: ROLES.SUPER_ADMIN,
  SUPER_ADMIN: ROLES.SUPER_ADMIN,
  ADMIN: ROLES.ADMIN,
  TEACHER: ROLES.TEACHER,
  STUDENT: ROLES.STUDENT,
  PARENT: ROLES.PARENT,
};

export function normalizeRole(role?: string | null): Role {
  if (!role) return ROLES.STUDENT;
  return ROLE_ALIASES[String(role).trim()] ?? ROLES.STUDENT;
}

/** Niveau d'autorité (utilisé pour empêcher l'escalade). */
export const ROLE_RANK: Record<Role, number> = {
  STUDENT: 10,
  PARENT: 15,
  TEACHER: 30,
  ADMIN: 60,
  SUPER_ADMIN: 100,
};

export function roleRank(role?: string | null): number {
  return ROLE_RANK[normalizeRole(role)];
}

/* ----------------------------- Permissions ---------------------------- */

export const PERMISSIONS = {
  // Tableau de bord & profil
  DASHBOARD_VIEW: "dashboard.view",
  PROFILE_EDIT: "profile.edit",

  // Utilisateurs & comptes
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  USERS_MANAGE_ROLES: "users.manage_roles",

  // Classes & élèves
  CLASSES_READ: "classes.read",
  CLASSES_CREATE: "classes.create",
  CLASSES_UPDATE: "classes.update",
  CLASSES_DELETE: "classes.delete",

  // Notes & évaluations
  GRADES_READ: "grades.read",
  GRADES_CREATE: "grades.create",
  GRADES_UPDATE: "grades.update",

  // Devoirs / documents pédagogiques
  ASSIGNMENTS_MANAGE: "assignments.manage",
  DOCUMENTS_READ: "documents.read",
  DOCUMENTS_MANAGE: "documents.manage",

  // Présence
  ATTENDANCE_READ: "attendance.read",
  ATTENDANCE_MANAGE: "attendance.manage",

  // Matières
  SUBJECTS_READ: "subjects.read",
  SUBJECTS_MANAGE: "subjects.manage",

  // Paiements
  PAYMENTS_READ: "payments.read",
  PAYMENTS_MANAGE: "payments.manage",

  // Établissements (multi-tenant)
  SCHOOLS_READ: "schools.read",
  SCHOOLS_MANAGE_OWN: "schools.manage_own",
  SCHOOLS_MANAGE_ALL: "schools.manage_all",

  // Communication, annonces, calendrier
  COMMUNICATION_USE: "communication.use",
  ANNOUNCEMENTS_MANAGE: "announcements.manage",

  // IA
  AI_USE: "ai.use",
  AI_CONFIGURE: "ai.configure",
  AI_CLASS_ANALYSIS: "ai.class_analysis",
  AI_ASSISTANT_USE: "ai.assistant_use",
  AI_SUPPORT_PLAN: "ai.support_plan",
  AI_DOCUMENT_GENERATE: "ai.document_generate",

  // Documents
  DOCUMENTS_GENERATE: "documents.generate",

  // Notifications
  NOTIFICATIONS_READ: "notifications.read",
  NOTIFICATIONS_MANAGE: "notifications.manage",

  // Automatisation
  AUTOMATION_MANAGE: "automation.manage",
  AUTOMATION_READ: "automation.read",

  // Analytics
  ANALYTICS_VIEW: "analytics.view",
  ANALYTICS_VIEW_ALL: "analytics.view_all",

  // Ambassadeurs
  AMBASSADOR_MANAGE: "ambassador.manage",

  // Partenaires
  PARTNER_MANAGE: "partner.manage",

  // Programme pilote
  PILOT_PROGRAM_MANAGE: "pilot_program.manage",

  // Système / Core
  MODULES_MANAGE: "modules.manage",
  PLUGINS_MANAGE: "plugins.manage",
  SYSTEM_CONFIGURE: "system.configure",
  SYSTEM_MANAGE: "system.manage",

  // Année académique
  ACADEMIC_YEAR_READ: "academic_year.read",
  ACADEMIC_YEAR_MANAGE: "academic_year.manage",

  // Audit
  AUDIT_READ: "audit.read",

  // EduSync Tools
  TOOLS_USE: "tools.use",
  TOOLS_MANAGE: "tools.manage",

  // EduSync Knowledge
  KNOWLEDGE_READ: "knowledge.read",
  KNOWLEDGE_MANAGE: "knowledge.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Liste exhaustive (pour SUPER_ADMIN = tout). */
const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/** Base élève (cumulative). */
const STUDENT_PERMS = new Set<string>([
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.PROFILE_EDIT,
  PERMISSIONS.SUBJECTS_READ,
  PERMISSIONS.CLASSES_READ,
  PERMISSIONS.GRADES_READ,
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.DOCUMENTS_READ,
  PERMISSIONS.COMMUNICATION_USE,
  PERMISSIONS.AI_USE,
  PERMISSIONS.AI_ASSISTANT_USE,
  PERMISSIONS.AI_DOCUMENT_GENERATE,
  PERMISSIONS.DOCUMENTS_GENERATE,
  PERMISSIONS.NOTIFICATIONS_READ,
  PERMISSIONS.ACADEMIC_YEAR_READ,
]);

/** Enseignant = élève + outils pédagogiques. */
const TEACHER_PERMS = new Set<string>([
  ...STUDENT_PERMS,
  PERMISSIONS.GRADES_CREATE,
  PERMISSIONS.GRADES_UPDATE,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.ASSIGNMENTS_MANAGE,
  PERMISSIONS.DOCUMENTS_MANAGE,
  PERMISSIONS.ANNOUNCEMENTS_MANAGE,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_CREATE,
  PERMISSIONS.AI_CLASS_ANALYSIS,
  PERMISSIONS.AI_SUPPORT_PLAN,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.NOTIFICATIONS_MANAGE,
  PERMISSIONS.AUTOMATION_READ,
  PERMISSIONS.TOOLS_USE,
  PERMISSIONS.KNOWLEDGE_READ,
]);

/** Admin d'établissement = enseignant + gestion de son établissement. */
const ADMIN_PERMS = new Set<string>([
  ...TEACHER_PERMS,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.CLASSES_CREATE,
  PERMISSIONS.CLASSES_UPDATE,
  PERMISSIONS.CLASSES_DELETE,
  PERMISSIONS.SUBJECTS_MANAGE,
  PERMISSIONS.PAYMENTS_READ,
  PERMISSIONS.PAYMENTS_MANAGE,
  PERMISSIONS.SCHOOLS_READ,
  PERMISSIONS.SCHOOLS_MANAGE_OWN,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.ACADEMIC_YEAR_MANAGE,
  PERMISSIONS.AI_ASSISTANT_USE,
  PERMISSIONS.ANALYTICS_VIEW_ALL,
  PERMISSIONS.NOTIFICATIONS_MANAGE,
  PERMISSIONS.AUTOMATION_MANAGE,
  PERMISSIONS.TOOLS_MANAGE,
  PERMISSIONS.KNOWLEDGE_MANAGE,
]);

/** Parent = consultation limitée (suivi de l'enfant). */
const PARENT_PERMS = new Set<string>([
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.PROFILE_EDIT,
  PERMISSIONS.GRADES_READ,
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.DOCUMENTS_READ,
  PERMISSIONS.COMMUNICATION_USE,
  PERMISSIONS.AI_USE,
  PERMISSIONS.AI_ASSISTANT_USE,
  PERMISSIONS.AI_DOCUMENT_GENERATE,
  PERMISSIONS.DOCUMENTS_GENERATE,
  PERMISSIONS.NOTIFICATIONS_READ,
  PERMISSIONS.ACADEMIC_YEAR_READ,
]);

/** Super Admin = tout (rôle système propriétaire de la plateforme). */
const SUPER_ADMIN_PERMS = new Set<string>(ALL_PERMISSIONS);

/**
 * Matrice de création de comptes — source unique des rôles qu'un acteur peut créer.
 * Hiérarchie stricte (anti-escalade) :
 *   SUPER_ADMIN -> ADMIN, TEACHER, STUDENT, PARENT
 *   ADMIN       -> TEACHER uniquement
 *   TEACHER     -> STUDENT, PARENT
 *   STUDENT     -> aucun
 */
export const CREATABLE_ROLES: Record<Role, Role[]> = {
  SUPER_ADMIN: [ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT, ROLES.PARENT],
  ADMIN: [ROLES.TEACHER],
  TEACHER: [ROLES.STUDENT, ROLES.PARENT],
  STUDENT: [],
  PARENT: [],
};

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<string>> = {
  STUDENT: STUDENT_PERMS,
  PARENT: PARENT_PERMS,
  TEACHER: TEACHER_PERMS,
  ADMIN: ADMIN_PERMS,
  SUPER_ADMIN: SUPER_ADMIN_PERMS,
};

/** L'acteur possède-t-il la permission ? (source de vérité serveur) */
export function can(role: string | null | undefined, permission: string): boolean {
  const r = normalizeRole(role);
  return ROLE_PERMISSIONS[r].has(permission);
}

/** Permissions effectives d'un rôle (injectées dans la session côté client). */
export function permissionsForRole(role: string | null | undefined): string[] {
  return [...ROLE_PERMISSIONS[normalizeRole(role)]];
}

/* ---------------------- Statuts de compte (DEMO vs PROD) -------------- */

export const STATUSES = {
  ACTIVE: "ACTIVE",
  DEMO: "DEMO",
  SUSPENDED: "SUSPENDED",
  PENDING: "PENDING",
} as const;

const STATUS_ALIASES: Record<string, string> = {
  actif: STATUSES.ACTIVE,
  suspendu: STATUSES.SUSPENDED,
  en_attente: STATUSES.PENDING,
  transfere: STATUSES.SUSPENDED,
  ACTIVE: STATUSES.ACTIVE,
  DEMO: STATUSES.DEMO,
  SUSPENDED: STATUSES.SUSPENDED,
  PENDING: STATUSES.PENDING,
};

export function normalizeStatus(status?: string | null): string {
  if (!status) return STATUSES.ACTIVE;
  return STATUS_ALIASES[String(status).trim()] ?? String(status).trim();
}

/** Un compte peut-il se connecter ? (DEMO/ACTIVE oui ; SUSPENDED/PENDING non). */
export function isLoginAllowed(status?: string | null): boolean {
  const s = normalizeStatus(status);
  return s === STATUSES.ACTIVE || s === STATUSES.DEMO;
}

/* -------------------------- Scoping multi-tenant ---------------------- */

/**
 * Détermine si un acteur peut accéder aux données d'un school_id donné.
 * SUPER_ADMIN = tous ; ADMIN = le sien ; autres = le sien uniquement.
 */
export function canAccessSchool(
  actorRole: string | null | undefined,
  actorSchoolId: string | null | undefined,
  targetSchoolId: string | null | undefined,
): boolean {
  if (normalizeRole(actorRole) === ROLES.SUPER_ADMIN) return true;
  if (!actorSchoolId) return false;
  return actorSchoolId === targetSchoolId;
}

/* ------------------- EduSync Knowledge — helpers ---------------------- */

/** Session minimale attendue (jamais de confiance au frontend : rôle lu côté serveur). */
type KnowledgeSessionLike = { role?: string | null; user?: { role?: string | null } } | null | undefined;

export function canReadKnowledge(session: KnowledgeSessionLike): boolean {
  const role = session?.user?.role ?? session?.role ?? null;
  return can(role, PERMISSIONS.KNOWLEDGE_READ);
}

export function canManageKnowledge(session: KnowledgeSessionLike): boolean {
  const role = session?.user?.role ?? session?.role ?? null;
  return can(role, PERMISSIONS.KNOWLEDGE_MANAGE);
}
