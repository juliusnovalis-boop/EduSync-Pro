import { eq } from "drizzle-orm";
import { db, ensureCurrentSchema } from "@/db";
import { appSettings, appUsers, academicYears } from "@/db/schema";
import { sha256 } from "./auth";
import { ROLES, STATUSES } from "./rbac";

/**
 * Amorce les paramètres applicatifs et les comptes officiels.
 * Le Super Admin est un VRAI compte en base (role=SUPER_ADMIN, status=ACTIVE) —
 * jamais défini par un `if (email === ...)` côté login.
 */

type AccountSpec = {
  loginId: string;
  fullName: string;
  email: string | null;
  role: string;
  status: string;
  schoolId: string | null;
  password: string;
};

async function ensureUser(spec: AccountSpec) {
  const existing = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.login_id, spec.loginId)).limit(1);
  if (existing.length) return;
  const now = new Date().toISOString();
  await db.insert(appUsers).values({
    id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    login_id: spec.loginId,
    password_hash: sha256(spec.password),
    full_name: spec.fullName,
    email: spec.email,
    role: spec.role,
    status: spec.status,
    school_id: spec.schoolId,
    created_at: now,
    updated_at: now,
  });
}

let appDefaultsPromise: Promise<void> | null = null;

// Corps réel d'amorçage — appelé UNE SEULE fois par processus via le cache
// `ensureAppDefaults` (voir en fin de fichier).
async function ensureAppDefaultsUncached() {
  // Amorce le schéma de démonstration si l'on opère en environnement démo.
  await ensureCurrentSchema();
  const now = new Date().toISOString();

  // Paramètres IA par défaut (compatibilité existante).
  const defaults: Array<[string, string]> = [
    ["ai_provider", "auto"],
    ["ai_model", ""],
    ["ai_length", "exhaustif"],
  ];
  for (const [key, value] of defaults) {
    const existing = await db.select({ key: appSettings.key }).from(appSettings).where(eq(appSettings.key, key)).limit(1);
    if (!existing.length) await db.insert(appSettings).values({ key, value, updated_at: now });
  }

  const adminEmail = (process.env.SUPER_ADMIN_EMAIL || "admin@edusync.ga").trim().toLowerCase();
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || "admin26";

  // 1) Super Admin officiel (propriétaire de la plateforme) — ACTIVE.
  await ensureUser({
    loginId: adminEmail,
    fullName: "Super Administrateur",
    email: adminEmail,
    role: ROLES.SUPER_ADMIN,
    status: STATUSES.ACTIVE,
    schoolId: null, // aucun établissement
    password: adminPassword,
  });

  // 2) Compte démo (admin d'établissement) — DEMO (fonctionnalités limitées).
  await ensureUser({
    loginId: "EDU-DEMO2026",
    fullName: "Administrateur Démo",
    email: "demo@edusync.ga",
    role: ROLES.ADMIN,
    status: STATUSES.DEMO,
    schoolId: "est-libreville",
    password: "demo2026",
  });

  // 3) Comptes de test par rôle (DEMO) — pour valider le RBAC de bout en bout.
  await ensureUser({
    loginId: "EDU-TEACH2026",
    fullName: "Enseignant Démo",
    email: "teacher@edusync.ga",
    role: ROLES.TEACHER,
    status: STATUSES.DEMO,
    schoolId: "est-libreville",
    password: "teach2026",
  });
  await ensureUser({
    loginId: "EDU-STU2026",
    fullName: "Élève Démo",
    email: "student@edusync.ga",
    role: ROLES.STUDENT,
    status: STATUSES.DEMO,
    schoolId: "est-libreville",
    password: "stu2026",
  });

  // 4) Année académique par défaut (ACTIVE) si aucune n'existe.
  const yearRows = await db.select({ id: academicYears.id }).from(academicYears).limit(1);
  if (!yearRows.length) {
    const ynow = new Date().toISOString();
    await db.insert(academicYears).values({
      id: "ay-2025-2026",
      name: "2025–2026",
      start_date: "2025-09-01",
      end_date: "2026-08-31",
      status: "ACTIVE",
      created_at: ynow,
      updated_at: ynow,
      created_by: null,
    });
  }
}
/**
 * Garantit que l'amorçage des paramètres/comptes/année par défaut n'est exécuté
 * QU'UNE fois par processus (Promise en vol, double-checked lock). Le premier
 * appel réalise la séquence de `SELECT` de garde + INSERT (idempotent) ; les
 * suivants retournent immédiatement la même Promise (O(1)). Un échec réinitialise
 * le garde pour permettre une nouvelle tentative. L'idempotence des gardes reste
 * valable en multi-instances (scale-out) : aucun INSERT si la ligne existe déjà.
 * Conservé sous le nom historique `ensureAppDefaults` pour ne changer aucun appelant.
 */
export async function ensureAppDefaults(): Promise<void> {
  if (appDefaultsPromise) return appDefaultsPromise;
  appDefaultsPromise = ensureAppDefaultsUncached().catch((e: unknown) => {
    appDefaultsPromise = null;
    throw e;
  });
  return appDefaultsPromise;
}
