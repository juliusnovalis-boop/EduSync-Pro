import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, establishments, students, teachers } from "@/db/schema";
import { requirePermission, sha256, genLoginId, genPassword, newUserId, createStudentFiche, createTeacherFiche, revokeUserSessions } from "@/lib/server/auth";
import { PERMISSIONS, ROLES, CREATABLE_ROLES, normalizeRole, normalizeStatus, roleRank } from "@/lib/server/rbac";
import { logAudit, AUDIT_ACTIONS } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

/** Scinde « Prénom NOM » → { first_name, last_name } (le prénom = le 1er mot). */
function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = String(fullName).trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first_name: trimmed, last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

// sql importé pour d'éventuelles requêtes scopées futures (multi-tenant étendu).
void sql;

type PublicUser = {
  id: string;
  login_id: string;
  full_name: string;
  email: string | null;
  role: string;
  status: string;
  school_id: string | null;
  school_name: string | null;
  created_at: string | null;
  last_login_at: string | null;
};

function publicRow(u: typeof appUsers.$inferSelect, schoolName?: string | null): PublicUser {
  return {
    id: u.id,
    login_id: u.login_id ?? "",
    full_name: u.full_name ?? "",
    email: u.email ?? null,
    role: normalizeRole(u.role),
    status: normalizeStatus(u.status),
    school_id: u.school_id ?? null,
    school_name: schoolName ?? null,
    created_at: u.created_at ?? null,
    last_login_at: u.last_login_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.USERS_READ);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const actor = auth.actor;

  // Scoping multi-tenant : un ADMIN ne voit que les comptes de son établissement.
  // Jointure sur establishments pour le nom de l'établissement.
  const cols = {
    id: appUsers.id,
    login_id: appUsers.login_id,
    full_name: appUsers.full_name,
    email: appUsers.email,
    role: appUsers.role,
    status: appUsers.status,
    school_id: appUsers.school_id,
    last_login_at: appUsers.last_login_at,
    created_at: appUsers.created_at,
    school_name: establishments.name,
  };
  const base = () =>
    db.select(cols).from(appUsers).leftJoin(establishments, eq(appUsers.school_id, establishments.id));
  const rows =
    actor.role === ROLES.SUPER_ADMIN
      ? await base().orderBy(appUsers.created_at)
      : await base().where(eq(appUsers.school_id, actor.schoolId ?? "")).orderBy(appUsers.created_at);

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      login_id: r.login_id ?? "",
      full_name: r.full_name ?? "",
      email: r.email ?? null,
      role: normalizeRole(r.role),
      status: normalizeStatus(r.status),
      school_id: r.school_id ?? null,
      school_name: r.school_name ?? null,
      created_at: r.created_at ?? null,
      last_login_at: r.last_login_at ?? null,
    })),
  );
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.USERS_CREATE);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const actor = auth.actor;

  try {
    const { full_name, role, email } = (await req.json()) as { full_name?: string; role?: string; email?: string };

    // Rôles assignables selon l'acteur (matrice stricte — anti-escalade).
    // Source : CREATABLE_ROLES (lib/server/rbac.ts). Jamais de fallback silencieux :
    // si le rôle demandé n'est pas autorisé → refus explicite 403.
    const finalRole = normalizeRole(role);
    const assignable = CREATABLE_ROLES[normalizeRole(actor.role)];
    if (role && !assignable.includes(finalRole)) {
      return NextResponse.json(
        { error: `Votre rôle (${actor.role}) ne permet pas de créer des comptes ${finalRole}.` },
        { status: 403 },
      );
    }
    if (!role) {
      return NextResponse.json({ error: "Rôle requis pour la création de compte." }, { status: 400 });
    }

    if (!String(full_name ?? "").trim()) return NextResponse.json({ error: "Nom complet requis." }, { status: 400 });

    // login_id unique
    let loginId = genLoginId();
    for (let i = 0; i < 5; i++) {
      const existing = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.login_id, loginId)).limit(1);
      if (!existing.length) break;
      loginId = genLoginId();
    }

        const password = genPassword();
    const now = new Date().toISOString();
    const isSuper = actor.role === ROLES.SUPER_ADMIN;
    const userId = newUserId(); // UUID interne (distinct du login_id public EDU-XXXXXXXX)
    const row = {
      id: userId,
      login_id: loginId, // EDU-XXXXXXXX, unicité vérifiée ci-dessus
      password_hash: sha256(password), // jamais de mot de passe en clair
      full_name: String(full_name).trim(),
      email: email ?? null,
      role: finalRole,
      status: "ACTIVE",
      school_id: isSuper ? null : actor.schoolId, // rattaché à l'établissement de l'admin
      must_change_password: false, // mot de passe PERMANENT (généré, non modifiable par l'utilisateur)
      created_at: now,
      updated_at: now,
    };

    // Réforme des comptes : un compte métier (STUDENT / TEACHER) crée impérativement sa
    // fiche métier liée DANS LA MÊME TRANSACTION que le compte app_users. En cas d'erreur,
    // rollback total → jamais de compte orpheline sans profil lié.
    await db.transaction(async (tx) => {
      await tx.insert(appUsers).values(row);

      if (finalRole === ROLES.STUDENT) {
        const nm = splitFullName(String(full_name));
        await createStudentFiche(tx, {
          first_name: nm.first_name,
          last_name: nm.last_name,
          parent_email: email ?? null,
          user_id: userId,
          school_year: "",
          created_at: now,
        });
      } else if (finalRole === ROLES.TEACHER) {
        const nm = splitFullName(String(full_name));
        await createTeacherFiche(tx, {
          first_name: nm.first_name,
          last_name: nm.last_name,
          email: email ?? null,
          user_id: userId,
          created_at: now,
        });
      }
    });

    // L'audit est journalisé APRÈS la transaction validée (hors rollback).
    await logAudit({
      actor_id: actor.userId,
      actor_role: actor.role,
      action: finalRole === ROLES.ADMIN ? AUDIT_ACTIONS.ADMIN_CREATED : AUDIT_ACTIONS.USER_CREATED,
      target_id: userId,
      metadata: { role: finalRole, login_id: loginId, school_id: row.school_id },
    });
    if (finalRole === ROLES.STUDENT) {
      await logAudit({
        actor_id: actor.userId, actor_role: actor.role,
        action: AUDIT_ACTIONS.STUDENT_PROFILE_CREATED,
        target_id: userId,
        metadata: { login_id: loginId },
      });
    } else if (finalRole === ROLES.TEACHER) {
      await logAudit({
        actor_id: actor.userId, actor_role: actor.role,
        action: AUDIT_ACTIONS.TEACHER_PROFILE_CREATED,
        target_id: userId,
        metadata: { login_id: loginId },
      });
    }

    const created: typeof appUsers.$inferSelect = { ...row, must_change_password: false, last_login_at: null } as typeof appUsers.$inferSelect;
    return NextResponse.json({ user: publicRow(created), credentials: { id: loginId, password } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.USERS_UPDATE);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const actor = auth.actor;

  try {
    const { id, full_name, role, status, regenerate } = (await req.json()) as {
      id?: string; full_name?: string; role?: string; status?: string; regenerate?: boolean; email?: string;
    };
    if (!id) return NextResponse.json({ error: "Identifiant de compte requis." }, { status: 400 });

    const currentRows = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
    const current = currentRows[0];
    if (!current) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

    // Scoping : un admin ne modifie que les comptes de son établissement.
    if (actor.role !== ROLES.SUPER_ADMIN && current.school_id !== actor.schoolId) {
      return NextResponse.json({ error: "Accès refusé : hors établissement." }, { status: 403 });
    }
    // Anti-escalade : on ne touche pas un compte de rang supérieur ou égal (sauf SUPER_ADMIN).
    if (actor.role !== ROLES.SUPER_ADMIN && roleRank(current.role) >= roleRank(actor.role)) {
      return NextResponse.json({ error: "Accès refusé : privilèges insuffisants." }, { status: 403 });
    }

    const roleChanged = role && normalizeRole(role) !== normalizeRole(current.role);
    // Un changement de rôle est réservé au Super Admin (anti-escalade de privilèges).
    if (roleChanged && actor.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ error: "Seul le Super Admin peut changer les rôles." }, { status: 403 });
    }
    // On ne peut pas attribuer un rang supérieur au sien.
    if (role && roleRank(role) > roleRank(actor.role)) {
      return NextResponse.json({ error: "Impossible d'attribuer un rôle supérieur au vôtre." }, { status: 403 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof full_name === "string" && full_name.trim()) update.full_name = full_name.trim();
    if (role) update.role = normalizeRole(role);
    if (status) update.status = normalizeStatus(status);

    let newPassword: string | null = null;
    if (regenerate) {
      newPassword = genPassword();
      update.password_hash = sha256(newPassword);
    }

    const [updated] = await db.update(appUsers).set(update).where(eq(appUsers.id, id)).returning();

    // Changement critique (suspension, changement de rôle, reset mot de passe) →
    // toutes les sessions du compte sont révoquées immédiatement.
    if (status === "SUSPENDED" || roleChanged || regenerate) {
      await revokeUserSessions(id, status === "SUSPENDED" ? "suspended" : roleChanged ? "role_changed" : "password_reset");
    }

    await logAudit({
      actor_id: actor.userId,
      actor_role: actor.role,
      action: roleChanged ? AUDIT_ACTIONS.ROLE_CHANGED : status === "SUSPENDED" ? AUDIT_ACTIONS.USER_SUSPENDED : AUDIT_ACTIONS.USER_UPDATED,
      target_id: id,
      metadata: { role: role ?? null, status: status ?? null, regenerated: Boolean(regenerate) },
    });
    // Réinitialisation exceptionnelle : nouveau mot de passe généré automatiquement (jamais choisi par l'utilisateur).
    // Le mot de passe généré n'est JAMAIS enregistré dans les logs.
    if (regenerate) {
      await logAudit({
        actor_id: actor.userId,
        actor_role: actor.role,
        action: AUDIT_ACTIONS.PASSWORD_RESET,
        target_id: id,
        metadata: { target_user_id: id, reason: "admin reset (perte/compromission)" },
      });
    }
    if (roleChanged) {
      await logAudit({ actor_id: actor.userId, actor_role: actor.role, action: AUDIT_ACTIONS.SUPER_ADMIN_ACTION, target_id: id, metadata: { detail: "role change", from: current.role, to: normalizeRole(role) } });
    }

    return NextResponse.json({ user: publicRow(updated), credentials: newPassword ? { id: updated.login_id, password: newPassword } : null });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.USERS_DELETE);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const actor = auth.actor;

  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "Identifiant de compte requis." }, { status: 400 });

    const currentRows = await db.select({ role: appUsers.role, school_id: appUsers.school_id }).from(appUsers).where(eq(appUsers.id, id)).limit(1);
    const current = currentRows[0];
    if (!current) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    if (actor.role !== ROLES.SUPER_ADMIN && current.school_id !== actor.schoolId) {
      return NextResponse.json({ error: "Accès refusé : hors établissement." }, { status: 403 });
    }
    if (actor.role !== ROLES.SUPER_ADMIN && roleRank(current.role) >= roleRank(actor.role)) {
      return NextResponse.json({ error: "Accès refusé : privilèges insuffisants." }, { status: 403 });
    }

    // Suppression du compte → révocation de toutes ses sessions.
    await revokeUserSessions(id, "account_deleted");
    await db.delete(appUsers).where(eq(appUsers.id, id));
    await logAudit({ actor_id: actor.userId, actor_role: actor.role, action: AUDIT_ACTIONS.USER_DELETED, target_id: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// sql importé pour d'éventuelles requêtes scopées futures (multi-tenant étendu).
void sql;
