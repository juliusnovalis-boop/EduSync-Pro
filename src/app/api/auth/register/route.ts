import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { sha256, genLoginId, createSession, setSessionCookie } from "@/lib/server/auth";
import { ensureAppDefaults } from "@/lib/server/ensure-defaults";
import { normalizeRole, normalizeStatus, permissionsForRole, ROLES, STATUSES } from "@/lib/server/rbac";
import { logAudit, AUDIT_ACTIONS } from "@/lib/server/audit";
import { bindRequestEnvironment } from "@/lib/server/environment";
import { ensureCurrentSchema } from "@/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register — INSCRIPTION DÉMO UNIQUEMENT.
 *
 * Crée un compte EXCLUSIVEMENT dans le schéma de démonstration (jamais en
 * production). L'environnement est vérifié côté serveur : si la requête n'est
 * pas en environnement démo, l'inscription est refusée. Le mot de passe est
 * choisi par l'utilisateur et stocké en SHA-256.
 */
export async function POST(req: NextRequest) {
  // Vérification serveur de l'environnement : démo obligatoire.
  const environment = bindRequestEnvironment(req);
  if (environment !== "demo") {
    return NextResponse.json(
      { error: "L'inscription n'est disponible qu'en environnement de démonstration." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    full_name?: string;
    email?: string;
    password?: string;
  };

  const fullName = String(body.full_name ?? "").trim();
  const email = body.email ? String(body.email).trim().toLowerCase() : null;
  const password = String(body.password ?? "");

  if (fullName.length < 2) {
    return NextResponse.json({ error: "Veuillez saisir votre nom complet." }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Le mot de passe doit comporter au moins 4 caractères." }, { status: 400 });
  }

  await ensureCurrentSchema();
  await ensureAppDefaults();

  // login_id unique (dans le schéma démo).
  let loginId = genLoginId();
  for (let i = 0; i < 6; i++) {
    const existing = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.login_id, loginId)).limit(1);
    if (!existing.length) break;
    loginId = genLoginId();
  }

  const now = new Date().toISOString();
  const [created] = await db
    .insert(appUsers)
    .values({
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      login_id: loginId,
      password_hash: sha256(password),
      full_name: fullName,
      email,
      role: ROLES.ADMIN, // exploration complète du bac à sable démo (rôle existant, inchangé)
      status: STATUSES.DEMO,
      school_id: "est-libreville",
      must_change_password: false,
      created_at: now,
      updated_at: now,
    })
    .returning();

  const role = normalizeRole(created.role);
  const status = normalizeStatus(created.status);
  // Crée une session démo persistante (révocable) + jeton HMAC signé.
  const session = await createSession({
    userId: created.id,
    role,
    environment: "demo",
    userAgent: req.headers.get("user-agent"),
  });

  await logAudit({
    actor_id: created.id,
    actor_role: role,
    action: AUDIT_ACTIONS.USER_CREATED,
    target_id: created.id,
    metadata: { environment: "demo", login_id: loginId, source: "self-registration" },
  });

  // Cookie HttpOnly dédié à l'environnement démo (séparé de l'officiel).
  const res = NextResponse.json({
    ok: true,
    session: {
      userId: created.id,
      loginId: created.login_id,
      name: created.full_name,
      email: created.email,
      role,
      status,
      schoolId: created.school_id ?? null,
      isSuperAdmin: false,
      mustChangePassword: false,
      permissions: permissionsForRole(role),
      environment: "demo",
    },
  });
  setSessionCookie(res, session.token, session.maxAge, req, "demo");
  return res;
}
