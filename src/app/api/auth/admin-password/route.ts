import { NextRequest, NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { getSessionActor, createSession, revokeUserSessions, setSessionCookie } from "@/lib/server/auth";
import { hashPassword, verifyPassword, satisfiesPasswordPolicy, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/server/security";
import { getActiveEnvironment } from "@/lib/server/environment";
import { logAudit, AUDIT_ACTIONS } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PUT /api/auth/admin-password { currentPassword, newPassword?, email? }
 *
 * Modifie le mot de passe et/ou l'e-mail du SUPER_ADMIN connecté (réauthentification
 * via le mot de passe courant). Réservé au SUPER_ADMIN.
 *  - newPassword (optionnel) : 6–32 caractères → après changement, ROTATION de session
 *    (les anciennes sessions sont révoquées, une nouvelle session sécurisée est émise).
 *  - email (optionnel) : format validé + unicité vérifiée.
 * Audit : PASSWORD_CHANGED / EMAIL_CHANGED. Aucune donnée sensible n'est journalisée.
 */
export async function PUT(req: NextRequest) {
  const actor = await getSessionActor(req);
  if (!actor) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (actor.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Seul le Super Admin peut modifier ses identifiants." }, { status: 403 });
  }

  try {
    const { currentPassword, newPassword, email } = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
      email?: string;
    };
    const current = String(currentPassword ?? "");
    const next = String(newPassword ?? "").trim();
    const nextEmail = String(email ?? "").trim().toLowerCase();

    if (!next && !nextEmail) {
      return NextResponse.json({ error: "Rien à modifier (mot de passe ou e-mail)." }, { status: 400 });
    }
    if (next && !satisfiesPasswordPolicy(next)) {
      return NextResponse.json(
        { error: `Le nouveau mot de passe doit contenir entre ${PASSWORD_MIN_LENGTH} et ${PASSWORD_MAX_LENGTH} caractères.` },
        { status: 400 },
      );
    }
    if (nextEmail && !EMAIL_RE.test(nextEmail)) {
      return NextResponse.json({ error: "Format d'e-mail invalide." }, { status: 400 });
    }

    // Réauthentification : mot de passe courant obligatoire.
    // F-17 : vérification scrypt (compatible avec les anciens condensés SHA-256).
    const rows = await db.select({ id: appUsers.id, password_hash: appUsers.password_hash }).from(appUsers).where(eq(appUsers.id, actor.userId)).limit(1);
    const user = rows[0];
    const reauth = user ? await verifyPassword(current, user.password_hash) : { ok: false, needsRehash: false };
    if (!user || !reauth.ok) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
    }

    // Unicité de l'e-mail (jamais en double).
    if (nextEmail) {
      const dup = await db
        .select({ id: appUsers.id })
        .from(appUsers)
        .where(and(eq(appUsers.email, nextEmail), ne(appUsers.id, actor.userId)))
        .limit(1);
      if (dup.length) return NextResponse.json({ error: "Cet e-mail est déjà utilisé par un autre compte." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };
    if (next) {
      // F-17 : scrypt + sel aléatoire (plus jamais de SHA-256 non salé).
      patch.password_hash = await hashPassword(next);
      patch.must_change_password = false;
    }
    if (nextEmail) patch.email = nextEmail;
    await db.update(appUsers).set(patch).where(eq(appUsers.id, actor.userId));

    if (next) await logAudit({ actor_id: actor.userId, actor_role: actor.role, action: AUDIT_ACTIONS.PASSWORD_CHANGED });
    if (nextEmail) await logAudit({ actor_id: actor.userId, actor_role: actor.role, action: AUDIT_ACTIONS.EMAIL_CHANGED, target_id: actor.userId });

    const res = NextResponse.json({ ok: true, email: nextEmail || undefined });

    // ROTATION de session sur changement de mot de passe : les anciennes sessions
    // (autres appareils) sont révoquées ; l'appareil courant reçoit une nouvelle session.
    if (next) {
      const env = getActiveEnvironment();
      await revokeUserSessions(actor.userId, "password_change");
      const ns = await createSession({ userId: actor.userId, role: actor.role, environment: env, userAgent: req.headers.get("user-agent") });
      setSessionCookie(res, ns.token, ns.maxAge, req, env);
    }
    return res;
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
