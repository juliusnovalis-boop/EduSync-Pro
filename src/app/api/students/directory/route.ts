import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, students } from "@/db/schema";
import { getSessionActor, createStudentFiche } from "@/lib/server/auth";
import { PERMISSIONS, ROLES, can, normalizeRole } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/**
 * Routes dédiées du Répertoire des élèves.
 *
 * Règle métier ABSOLUE : la Gestion des accès est la source de l'identité d'un
 * élève (compte STUDENT). Le Répertoire ne crée JAMAIS de fiche orpheline.
 *   GET   → comptes STUDENT de l'établissement SANS fiche (CAS A) + fiches
 *           orphelines historiques (réconciliation, jamais supprimées).
 *   POST  → créer une fiche métier LIÉE à un compte STUDENT existant (CAS A).
 *   PATCH → lier une fiche orpheline historique à un compte STUDENT (réconciliation).
 *
 * Multi-tenant : autorité = ACTEUR SERVEUR (schoolId du contexte), jamais un
 * schoolId fourni par le client.
 */

type DirectoryAccount = {
  id: string;
  login_id: string;
  full_name: string;
  email: string | null;
  school_id: string | null;
};

export async function GET(req: NextRequest) {
  const auth = await requireDirectoryAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const actor = auth.actor;

  try {
    const isSuper = normalizeRole(actor.role) === ROLES.SUPER_ADMIN;
    const schoolFilter = isSuper ? undefined : eq(appUsers.school_id, actor.schoolId ?? "__none__");

    // 1) Comptes STUDENT de l'établissement SANS fiche (CAS A).
    const unlinkedRows = await db
      .select({
        id: appUsers.id,
        login_id: appUsers.login_id,
        full_name: appUsers.full_name,
        email: appUsers.email,
        school_id: appUsers.school_id,
      })
      .from(appUsers)
      .leftJoin(students, eq(appUsers.id, students.user_id))
      .where(and(eq(appUsers.role, ROLES.STUDENT), isNull(students.user_id), ...(schoolFilter ? [schoolFilter] : [])));

    // 2) Fiches orphelines historiques (user_id null) → « À réconcilier ».
    const orphanRows = await db.select().from(students).where(isNull(students.user_id));

    const unlinked: DirectoryAccount[] = unlinkedRows.map((a) => ({
      id: a.id,
      login_id: a.login_id ?? "",
      full_name: a.full_name ?? "",
      email: a.email ?? null,
      school_id: a.school_id ?? null,
    }));

    return NextResponse.json({ unlinked, orphanFiches: orphanRows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** CAS A — créer une fiche métier liée à un compte STUDENT existant (jamais orpheline). */
export async function POST(req: NextRequest) {
  const auth = await requireDirectoryAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = (await req.json()) as {
      accountId?: string;
      first_name?: string;
      last_name?: string;
      gender?: string;
      birth_date?: string;
      matricule?: string;
      class_id?: string;
      school_year?: string;
      status?: string;
    };
    const accountId = String(body.accountId ?? "").trim();
    if (!accountId) return NextResponse.json({ error: "Compte STUDENT requis." }, { status: 400 });

    const accounts = await db
      .select({ id: appUsers.id, role: appUsers.role, school_id: appUsers.school_id })
      .from(appUsers)
      .where(eq(appUsers.id, accountId))
      .limit(1);
    const account = accounts[0];
    if (!account || normalizeRole(account.role) !== ROLES.STUDENT) {
      return NextResponse.json({ error: "Compte STUDENT introuvable." }, { status: 404 });
    }
    const isSuper = normalizeRole(auth.actor.role) === ROLES.SUPER_ADMIN;
    if (!isSuper && account.school_id !== auth.actor.schoolId) {
      return NextResponse.json({ error: "Accès refusé : hors établissement." }, { status: 403 });
    }

    // Un seul compte → une seule fiche (user_id UNIQUE).
    const existing = await db.select({ id: students.id }).from(students).where(eq(students.user_id, accountId)).limit(1);
    if (existing.length) {
      return NextResponse.json({ error: "Ce compte dispose déjà d'une fiche élève." }, { status: 409 });
    }

        const created = await createStudentFiche(db, {
      user_id: accountId,
      first_name: body.first_name ? String(body.first_name).trim() : "",
      last_name: body.last_name ? String(body.last_name).trim() : "",
      gender: body.gender ? String(body.gender).trim() : null,
      birth_date: body.birth_date ? String(body.birth_date).trim() : null,
      matricule: body.matricule ? String(body.matricule).trim() : null,
      class_id: body.class_id ? String(body.class_id).trim() : null,
      school_year: body.school_year ? String(body.school_year).trim() : null,
      status: body.status ? String(body.status).trim() : "actif",
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** Réconciliation — lier une fiche orpheline historique à un compte STUDENT (jamais supprimée). */
export async function PATCH(req: NextRequest) {
  const auth = await requireDirectoryAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = (await req.json()) as { studentId?: string; accountId?: string };
    const studentId = String(body.studentId ?? "").trim();
    const accountId = String(body.accountId ?? "").trim();
    if (!studentId || !accountId) {
      return NextResponse.json({ error: "Fiche et compte STUDENT requis." }, { status: 400 });
    }

    // La fiche doit être orpheline (user_id null) pour être réconciliable.
    const fiches = await db.select({ id: students.id, user_id: students.user_id }).from(students).where(eq(students.id, studentId)).limit(1);
    const fiche = fiches[0];
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
    if (fiche.user_id) {
      return NextResponse.json({ error: "Cette fiche est déjà liée à un compte." }, { status: 409 });
    }

    const accounts = await db
      .select({ id: appUsers.id, role: appUsers.role, school_id: appUsers.school_id })
      .from(appUsers)
      .where(eq(appUsers.id, accountId))
      .limit(1);
    const account = accounts[0];
    if (!account || normalizeRole(account.role) !== ROLES.STUDENT) {
      return NextResponse.json({ error: "Compte STUDENT introuvable." }, { status: 404 });
    }
    const isSuper = normalizeRole(auth.actor.role) === ROLES.SUPER_ADMIN;
    if (!isSuper && account.school_id !== auth.actor.schoolId) {
      return NextResponse.json({ error: "Accès refusé : hors établissement." }, { status: 403 });
    }

    const alreadyLinked = await db.select({ id: students.id }).from(students).where(eq(students.user_id, accountId)).limit(1);
    if (alreadyLinked.length) {
      return NextResponse.json({ error: "Ce compte dispose déjà d'une fiche élève." }, { status: 409 });
    }

    const [updated] = await db.update(students).set({ user_id: accountId }).where(eq(students.id, studentId)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * createStudentFiche est centralisé dans src/lib/server/auth.ts (réutilisé par la
 * création atomique depuis /api/auth/users et par ce répertoire).
 */
async function requireDirectoryAuth(req: NextRequest) {
  const actor = await getSessionActor(req);
  if (!actor) return { error: "Non authentifié", status: 401 } as const;
  const role = normalizeRole(actor.role);
  // Répertoire géré par le personnel (SUPER_ADMIN / ADMIN / TEACHER) : on s'appuie
  // sur users.create (déjà attribué à ces rôles), cohérent avec la Gestion des accès.
  if (!can(role, PERMISSIONS.USERS_CREATE)) {
    return { error: "Accès refusé", status: 403 } as const;
  }
  return { actor } as const;
}
