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
import { safeParseJson, clientIp, internalErrorResponse } from "@/lib/server/security";
import { ensureRateLimitSchema, loginRateLimiter } from "@/lib/server/security";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login { identifier, password }
 *
 * Durci (pentest #1 & #4) :
 *   • `Content-Type` strict → 415 si ce n'est pas du JSON ; JSON invalide → 400
 *     (plus AUCUN 500 sur body form-urlencoded) ;
 *   • rate limiting PERSISTANT (PostgreSQL, serverless-safe) par email + par IP,
 *     et verrouillage progressif (exponential backoff) — réponse 429 avec
 *     `Retry-After`, message générique ;
 *   • message d'échec identique pour compte inexistant et mauvais mot de passe
 *     (pas d'énumération de comptes) ;
 *   • erreur interne → 500 générique JSON `{ "error": "..." }`, sans stack trace.
 */
export async function POST(req: NextRequest) {
  if (!csrfOk(req)) {
    return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  }

  // Corps JSON strict (415 / 400, jamais de crash).
  const body = await safeParseJson<{ identifier?: string; password?: string }>(req);
  if (!body.ok) return body.response;

  const { identifier, password } = body.data ?? {};
  const id = String(identifier ?? "").trim();
  const pwd = String(password ?? "");

  if (!id || !pwd) {
    return NextResponse.json({ error: "Identifiant et mot de passe requis." }, { status: 400 });
  }

  try {
    // Environnement autoritaire côté serveur (header/chemin). Amorce le schéma démo si besoin.
    const environment: AppEnvironment = bindRequestEnvironment(req);
    await ensureRateLimitSchema();
    await ensureCurrentSchema();
    const ip = clientIp(req);

    // Anti-brute-force : email (5/15 min) + IP (10/15 min) + verrouillage progressif.
    const attempt = await loginRateLimiter.recordLoginAttempt(environment, id, ip);
    if (attempt.status !== "ok") {
      return NextResponse.json(
        { error: "Trop de tentatives de connexion. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSec ?? 60) } },
      );
    }

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
      await loginRateLimiter.onLoginFailure(environment, id);
      await logAudit({ actor_id: id, action: AUDIT_ACTIONS.LOGIN_DENIED, result: "denied" });
      return denied();
    }

    const status = normalizeStatus(user.status);
    if (!isLoginAllowed(status)) {
      await loginRateLimiter.onLoginFailure(environment, id);
      await logAudit({
        actor_id: user.id,
        actor_role: user.role,
        action: AUDIT_ACTIONS.LOGIN_DENIED,
        result: "denied",
      });
      return NextResponse.json(
        {
          error:
            status === "PENDING"
              ? "Compte en attente de validation."
              : "Compte suspendu — contactez votre établissement.",
        },
        { status: 403 },
      );
    }

    const role = normalizeRole(user.role);
    const schoolId = user.school_id ?? null;

    // Création d'une SESSION SÉCURISÉE persistante (révocable) + jeton HMAC signé.
    const created = await createSession({
      userId: user.id,
      role,
      environment,
      userAgent: req.headers.get("user-agent"),
    });

    // Succès → réinitialisation des compteurs anti-brute-force.
    await loginRateLimiter.onLoginSuccess(environment, id, ip);
    await logAudit({ actor_id: user.id, actor_role: role, action: AUDIT_ACTIONS.LOGIN });

    // Le jeton est remis via un cookie HttpOnly ; le corps porte les infos de
    // session (sans jeton), avec le jeton exposé uniquement pour le mobile.
    const res = NextResponse.json({
      ok: true,
      token: created.token,
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
    return internalErrorResponse(error);
  }
}