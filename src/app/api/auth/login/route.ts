import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { sha256, createSession, setSessionCookie, csrfOk } from "@/lib/server/auth";
import { ensureAppDefaults } from "@/lib/server/ensure-defaults";
import { normalizeRole, normalizeStatus, isLoginAllowed, permissionsForRole } from "@/lib/server/rbac";
import { logAudit, AUDIT_ACTIONS } from "@/lib/server/audit";
import { bindRequestEnvironment, type AppEnvironment } from "@/lib/server/environment";
import { ensureCurrentSchema } from "@/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login { identifier, password }
 *
 * Authentification UNIFIÉE : tous les comptes (y compris le Super Admin) sont des
 * lignes réelles de `app_users`, authentifiées par login_id + mot de passe.
 * ⚠ AUCUN `if (email === ...)` : le rôle et les droits proviennent de la base,
 * contrôlés par le système d'authentification serveur (jamais du frontend).
 */
export async function POST(req: NextRequest) {
  if (!csrfOk(req)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const { identifier, password } = (await req.json()) as { identifier?: string; password?: string };
  const id = String(identifier ?? "").trim();
  const pwd = String(password ?? "");

  if (!id || !pwd) {
    return NextResponse.json({ error: "Identifiant et mot de passe requis." }, { status: 400 });
  }

  try {
    // Environnement autoritaire côté serveur (header/chemin). Amorce le schéma démo si besoin.
    const environment: AppEnvironment = bindRequestEnvironment(req);
    await ensureCurrentSchema();

    await ensureAppDefaults();

    // Recherche insensible à la casse (login_id OU email) — dans le schéma actif.
    const users = await db
      .select()
      .from(appUsers)
      .where(sql`(lower(login_id) = lower(${id}) OR lower(COALESCE(email, '')) = lower(${id}))`)
      .limit(1);
    const user = users[0];

    // Message volontairement identique (ne fuite pas l'existence du compte).
    const denied = () => NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });

    if (!user || sha256(pwd) !== user.password_hash) {
      await logAudit({ actor_id: id, action: AUDIT_ACTIONS.LOGIN_DENIED, result: "denied" });
      return denied();
    }

    const status = normalizeStatus(user.status);
    if (!isLoginAllowed(status)) {
      await logAudit({ actor_id: user.id, actor_role: user.role, action: AUDIT_ACTIONS.LOGIN_DENIED, result: "denied" });
      return NextResponse.json(
        { error: status === "PENDING" ? "Compte en attente de validation." : "Compte suspendu — contactez votre établissement." },
        { status: 403 },
      );
    }

    const role = normalizeRole(user.role);
    const schoolId = user.school_id ?? null;

    // Création d'une SESSION SÉCURISÉE persistante (révocable) + jeton HMAC signé.
    // Durée déterminée par le rôle (cf. security-config).
    const created = await createSession({
      userId: user.id,
      role,
      environment,
      userAgent: req.headers.get("user-agent"),
    });

    await logAudit({ actor_id: user.id, actor_role: role, action: AUDIT_ACTIONS.LOGIN });

    // Le jeton est remis via un cookie HttpOnly (jamais lisible par JavaScript).
    // Le corps de réponse transporte uniquement les infos de session (sans jeton).
    const res = NextResponse.json({
      ok: true,
      session: {
        userId: user.id,
        loginId: user.login_id,
        name: user.full_name,
        email: user.email,
        role,
        status,
        schoolId,
        isSuperAdmin: role === "SUPER_ADMIN",
        mustChangePassword: Boolean(user.must_change_password),
        permissions: permissionsForRole(role),
        environment,
      },
    });
    setSessionCookie(res, created.token, created.maxAge, req, environment);
    return res;
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
