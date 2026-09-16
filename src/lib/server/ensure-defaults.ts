import { eq } from "drizzle-orm";
import { db, ensureCurrentSchema } from "@/db";
import { appSettings, appUsers, academicYears } from "@/db/schema";
import { hashPassword } from "./security/password";
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
    // F-17 : scrypt + sel aléatoire (jamais sha256 non salé).
    password_hash: await hashPassword(spec.password),
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

  /*
   * F-16/F-17 (pentest #2) — AUCUN identifiant par défaut en dur.
   * Avant : `SUPER_ADMIN_PASSWORD || admin26` et les mots de passe démo
   * « demo2026 / teach2026 / stu2026 » étaient écrits dans le code source :
   * quiconque lit le dépôt pouvait se connecter en Super Admin sur toute
   * instance où la variable d'environnement n'était pas définie.
   *
   * Désormais, l'amorçage est FAIL-CLOSED :
   *   • le Super Admin n'est créé QUE si SUPER_ADMIN_PASSWORD est configuré
   *     (les comptes déjà présents en base ne sont jamais touchés ni écrasés) ;
   *   • les comptes de démonstration ne sont créés QUE sur opt-in explicite
   *     (SEED_DEMO_ACCOUNTS=true) ET avec des mots de passe fournis par la
   *     configuration — jamais des valeurs devinables écrites dans le dépôt.
   */
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn(
      "[ensure-defaults] SUPER_ADMIN_PASSWORD absent : compte Super Admin non amorcé " +
        "(aucun mot de passe par défaut n'est utilisé). Configurez la variable puis redéployez.",
    );
  } else {
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
  }

  // 2) & 3) Comptes de démonstration — opt-in explicite uniquement.
  const demosEnabled = String(process.env.SEED_DEMO_ACCOUNTS ?? "").toLowerCase() === "true";
  const demoAdmin = process.env.DEMO_ADMIN_PASSWORD;
  const demoTeacher = process.env.DEMO_TEACHER_PASSWORD;
  const demoStudent = process.env.DEMO_STUDENT_PASSWORD;
  if (demosEnabled && demoAdmin && demoTeacher && demoStudent) {
    await ensureUser({
      loginId: "EDU-DEMO2026",
      fullName: "Administrateur Démo",
      email: "demo@edusync.ga",
      role: ROLES.ADMIN,
      status: STATUSES.DEMO,
      schoolId: "est-libreville",
      password: demoAdmin,
    });
    await ensureUser({
      loginId: "EDU-TEACH2026",
      fullName: "Enseignant Démo",
      email: "teacher@edusync.ga",
      role: ROLES.TEACHER,
      status: STATUSES.DEMO,
      schoolId: "est-libreville",
      password: demoTeacher,
    });
    await ensureUser({
      loginId: "EDU-STU2026",
      fullName: "Élève Démo",
      email: "student@edusync.ga",
      role: ROLES.STUDENT,
      status: STATUSES.DEMO,
      schoolId: "est-libreville",
      password: demoStudent,
    });
  } else if (demosEnabled) {
    console.warn(
      "[ensure-defaults] SEED_DEMO_ACCOUNTS=true mais DEMO_ADMIN_PASSWORD / DEMO_TEACHER_PASSWORD / " +
        "DEMO_STUDENT_PASSWORD incomplets : comptes démo non amorcés.",
    );
  }

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
