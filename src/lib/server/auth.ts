import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { appSettings, appUsers, sessions, students, teachers } from "@/db/schema";
import { can, normalizeRole, normalizeStatus, isLoginAllowed, permissionsForRole } from "./rbac";
import { bindEnvironment, detectEnvironment, getActiveEnvironment, type AppEnvironment } from "./environment";
import { hmacSecret, newSessionId, sessionDurationMs } from "./security-config";

type DbLike = NodePgDatabase<typeof schema>;
export { db, type DbLike };

/**
 * Sessions sécurisées EduSync Pro.
 *
 * Le jeton remis au client est un HMAC signé (body base64url + signature) ne
 * contenant QUE : { sid, uid, env, iat, exp }. Aucune donnée sensible.
 *
 * À chaque requête authentifiée, le serveur re-vérifie :
 *   1. la signature HMAC (le jeton a bien été émis par l'app et n'est pas modifié) ;
 *   2. l'expiration (exp ET session.expires_at) ;
 *   3. l'existence et l'état « active » de la session en base (→ RÉVOCATION possible) ;
 *   4. l'existence, le statut et le RÔLE du compte EN BASE (jamais depuis le jeton) ;
 *   5. la cohérence de l'environnement (session DEMO ≠ OFFICIEL).
 *
 * Mots de passe stockés en SHA-256, jamais en clair.
 */

export function sha256(input: string) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

/** Identifiant de connexion PUBLIC — format officiel EDU-XXXXXXXX (12 caractères). */
export function genLoginId() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let tail = "";
  for (let i = 0; i < 8; i++) tail += alphabet[crypto.randomInt(alphabet.length)];
  return `EDU-${tail}`;
}

/** Mot de passe initial — 8 caractères, génération cryptographiquement sécurisée. */
export function genPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

export function adminEmail() {
  return (process.env.SUPER_ADMIN_EMAIL || "juliusnovalis@gmail.com").trim().toLowerCase();
}

/** Clé primaire INTERNE d'un compte — UUID (distincte du login_id public). */
export function newUserId() {
  return crypto.randomUUID();
}

/**
 * Génère un identifiant métier court et unique (utilisé par les fiches
 * student/teacher créées atomiquement avec un compte app_users).
 */
export function newRecordId() {
  return crypto.randomUUID();
}

export interface StudentFicheInput {
  id?: string;
  first_name: string;
  last_name: string;
  gender?: string | null;
  birth_date?: string | null;
  matricule?: string | null;
  class_id?: string | null;
  user_id: string; // FK → app_users.id (compte STUDENT propriétaire)
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  address?: string | null;
  school_year?: string | null;
  status?: string;
  created_at?: string;
}

/**
 * Crée une fiche student liée à un compte app_users.
 * Utilisable en-dehors ou à l'intérieur d'une transaction (tx passé en 1er arg).
 */
export async function createStudentFiche(store: DbLike, data: StudentFicheInput) {
  const now = data.created_at ?? new Date().toISOString();
  const payload = {
    id: data.id ?? newRecordId(),
    first_name: data.first_name,
    last_name: data.last_name,
    gender: data.gender ?? null,
    birth_date: data.birth_date ?? null,
    matricule: data.matricule ?? null,
    class_id: data.class_id ?? null,
    user_id: data.user_id,
    parent_name: data.parent_name ?? null,
    parent_phone: data.parent_phone ?? null,
    parent_email: data.parent_email ?? null,
    address: data.address ?? null,
    school_year: data.school_year ?? null,
    status: data.status ?? "actif",
    created_at: now,
  };
  const rows = (await store
    .insert(students)
    .values(payload as never)
    .returning()) as unknown as Record<string, unknown>[];
  return rows[0] ?? payload;
}

export interface TeacherFicheInput {
  id?: string;
  first_name: string;
  last_name: string;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  user_id: string; // FK → app_users.id (compte TEACHER propriétaire)
  subject_names?: string[];
  hire_date?: string | null;
  status?: string;
  created_at?: string;
}

/**
 * Crée une fiche teacher liée à un compte app_users.
 * Utilisable en-dehors ou à l'intérieur d'une transaction (tx passé en 1er arg).
 */
export async function createTeacherFiche(store: DbLike, data: TeacherFicheInput) {
  const now = data.created_at ?? new Date().toISOString();
  const payload = {
    id: data.id ?? newRecordId(),
    first_name: data.first_name,
    last_name: data.last_name,
    gender: data.gender ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    user_id: data.user_id,
    subject_names: data.subject_names ?? [],
    hire_date: data.hire_date ?? now.split("T")[0],
    status: data.status ?? "actif",
    created_at: now,
  };
  const rows = (await store
    .insert(teachers)
    .values(payload as never)
    .returning()) as unknown as Record<string, unknown>[];
  return rows[0] ?? payload;
}

async function readSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function writeSetting(key: string, value: string) {
  const now = new Date().toISOString();
  await db
    .insert(appSettings)
    .values({ key, value, updated_at: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updated_at: now } });
}

export async function getAdminPasswordHash() {
  const dbValue = await readSetting("admin_password_hash");
  const defaultHash = sha256("admin26");
  const envPwd = process.env.SUPER_ADMIN_PASSWORD;
  const envHash = envPwd ? sha256(envPwd) : null;
  if (dbValue && dbValue !== defaultHash && dbValue !== envHash) return dbValue;
  if (envHash) return envHash;
  return dbValue || defaultHash;
}

export async function setAdminPasswordHash(hash: string) {
  await writeSetting("admin_password_hash", hash);
}

/* ====================== Jetons & sessions sécurisées ====================== */

/** Noms de cookies HttpOnly distincts par environnement (sessions DEMO ≠ OFFICIEL). */
export const PROD_SESSION_COOKIE = "edusync_session";
export const DEMO_SESSION_COOKIE = "edusync_demo_session";

function cookieName(env: AppEnvironment) {
  return env === "demo" ? DEMO_SESSION_COOKIE : PROD_SESSION_COOKIE;
}

/** Signe un payload (HMAC-SHA256) — body base64url + signature. N'ajoute rien d'autre. */
export function signToken(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", hmacSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Vérifie la signature + renvoie le payload décodé (sans contrôle d'expiration ici). */
export function verifyToken(token: string | null | undefined): Record<string, unknown> | null {
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", hmacSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Lit le jeton : cookie HttpOnly correspondant à l'environnement déclaré
 * (prioritaire), sinon en-tête Bearer (clients API / tests).
 */
export function readSessionToken(req: NextRequest): string | null {
  const declared = detectEnvironment(req);
  if (declared) {
    const c = req.cookies.get(cookieName(declared))?.value;
    if (c) return c;
  }
  const bearer = String(req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return bearer || null;
}

export type CreatedSession = {
  token: string;
  sessionId: string;
  environment: AppEnvironment;
  expiresAt: number;
  maxAge: number;
};

/** Crée une session persistante (révocable) + son jeton HMAC signé. */
export async function createSession(opts: {
  userId: string;
  role: string;
  environment: AppEnvironment;
  userAgent?: string | null;
}): Promise<CreatedSession> {
  const now = Date.now();
  const durationMs = sessionDurationMs(opts.role);
  const expiresAt = now + durationMs;
  const sessionId = newSessionId();
  const isoNow = new Date(now).toISOString();
  await db.insert(sessions).values({
    id: sessionId,
    user_id: opts.userId,
    environment: opts.environment,
    issued_at: isoNow,
    expires_at: new Date(expiresAt).toISOString(),
    status: "active",
    user_agent: opts.userAgent?.slice(0, 255) ?? null,
    created_at: isoNow,
  });
  // Horodate la dernière connexion (audit / affichage « dernière connexion »).
  try {
    await db.update(appUsers).set({ last_login_at: isoNow }).where(eq(appUsers.id, opts.userId));
  } catch {
    /* non bloquant */
  }
  // Jeton minimal : sid (session_id), uid, env, iat, exp. Aucune donnée sensible.
  const token = signToken({ sid: sessionId, uid: opts.userId, env: opts.environment, iat: now, exp: expiresAt });
  return { token, sessionId, environment: opts.environment, expiresAt, maxAge: Math.floor(durationMs / 1000) };
}

/** Révoque une session avant son expiration (déconnexion, suspension, compromission…). */
export async function revokeSession(sessionId: string, reason = "revoked") {
  try {
    await db.update(sessions).set({ status: "revoked", revoked_reason: reason }).where(eq(sessions.id, sessionId));
  } catch {
    /* session déjà absente */
  }
}

/** Révoque TOUTES les sessions actives d'un compte (changement critique / suppression). */
export async function revokeUserSessions(userId: string, reason = "account_changed") {
  try {
    await db.update(sessions).set({ status: "revoked", revoked_reason: reason }).where(eq(sessions.user_id, userId));
  } catch {
    /* ignore */
  }
}

export interface VerifiedSession {
  sessionId: string;
  userId: string;
  environment: AppEnvironment;
  role: string;
  status: string;
  schoolId: string | null;
  permissions: string[];
  loginId: string;
  name: string;
  email: string | null;
  mustChangePassword: boolean;
}

/**
 * Vérification COMPLÈTE d'une session. Source de vérité serveur.
 * Renvoie null si : signature invalide, expirée, session révoquée/inexistante,
 * compte introuvable/suspendu, ou incohérence d'environnement.
 */
export async function verifySession(req: NextRequest): Promise<VerifiedSession | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  const exp = Number(payload.exp);
  if (!exp || exp < Date.now()) return null; // jeton expiré
  const sid = String(payload.sid ?? "");
  const uid = String(payload.uid ?? "");
  const env: AppEnvironment = payload.env === "demo" ? "demo" : "production";
  if (!sid || !uid) return null;

  // Cohérence d'environnement AVANT tout accès base : la session doit correspondre
  // au contexte déclaré (DEMO ≠ OFFICIEL). Puis on ACTIVE l'environnement de la session
  // afin que les requêtes suivantes ciblent le BON schéma (démo vs production).
  const declared = detectEnvironment(req);
  if (declared !== null && declared !== env) return null;
  bindEnvironment(env);

  // (3) Session en base : doit exister, être active, correspondre à uid et env.
  const srows = await db.select().from(sessions).where(eq(sessions.id, sid)).limit(1);
  const sess = srows[0];
  if (!sess || sess.status !== "active") return null;
  if (sess.user_id !== uid) return null;
  if (sess.environment !== env) return null;
  if (new Date(sess.expires_at).getTime() < Date.now()) {
    await revokeSession(sid, "expired");
    return null;
  }

  // (4) Compte en base : doit exister et être autorisé à se connecter. RÔLE depuis la base.
  const urows = await db.select().from(appUsers).where(eq(appUsers.id, uid)).limit(1);
  const user = urows[0];
  if (!user) return null;
  const status = normalizeStatus(user.status);
  if (!isLoginAllowed(status)) return null; // compte suspendu → session invalide
  const role = normalizeRole(user.role);

  return {
    sessionId: sid,
    userId: uid,
    environment: env,
    role,
    status,
    schoolId: user.school_id ?? null,
    permissions: permissionsForRole(role),
    loginId: user.login_id ?? "",
    name: user.full_name ?? "",
    email: user.email ?? null,
    mustChangePassword: Boolean(user.must_change_password),
  };
}

export interface SessionActor {
  userId: string;
  role: string;
  schoolId: string | null;
  permissions: string[];
}

/** Vérifie une session et renvoie l'acteur normalisé (rôle depuis la base). */
export async function getSessionActor(req: NextRequest): Promise<SessionActor | null> {
  const v = await verifySession(req);
  if (!v) return null;
  return { userId: v.userId, role: v.role, schoolId: v.schoolId, permissions: v.permissions };
}

/** Vérifie l'authentification (et optionnellement un rôle). */
export async function requireAuth(req: NextRequest, roles: string[] | null = null) {
  const actor = await getSessionActor(req);
  if (!actor) return { error: "Non authentifié", status: 401 } as const;
  if (roles) {
    const r = normalizeRole(actor.role);
    const allowed = roles.map((x) => normalizeRole(x));
    if (!allowed.includes(r)) return { error: "Accès refusé", status: 403 } as const;
  }
  return { actor } as const;
}

/**
 * ⭐ Vérification RBAC côté serveur : l'acteur doit posséder la permission.
 * Source de vérité de l'autorisation (jamais l'UI seule, jamais le jeton seul).
 */
export async function requirePermission(req: NextRequest, permission: string) {
  const actor = await getSessionActor(req);
  if (!actor) return { error: "Non authentifié", status: 401 } as const;
  if (!can(actor.role, permission)) return { error: "Accès refusé", status: 403 } as const;
  return { actor } as const;
}

/**
 * Résolution d'environnement UNIFIÉE pour les routes de données (dashboard,
 * élèves, enseignants, classes…). Source unique : la SESSION authentifiée
 * (exactement comme /api/auth/users), avec repli sur le cookie pour les accès
 * anonymes. Renvoie null si l'environnement est indéterminé → la route DOIT
 * alors renvoyer une erreur explicite (jamais un tableau vide silencieux).
 *
 * Cela garantit que le tableau de bord et la Gestion des accès lisent TOUJOURS
 * le même environnement, et qu'aucune donnée DEMO ne fuite vers OFFICIEL.
 */
export async function resolveDataEnvironment(req: NextRequest): Promise<AppEnvironment | null> {
  const actor = await getSessionActor(req);
  if (actor) return getActiveEnvironment(); // env déjà lié par verifySession
  const declared = detectEnvironment(req);
  if (declared) {
    bindEnvironment(declared);
    return declared;
  }
  return null;
}

/* ============================ Cookies sécurisés =========================== */

function isSecureRequest(req: NextRequest): boolean {
  return req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
}

/** Pose le cookie de session HttpOnly (le navigateur ne peut pas lire le jeton via JS). */
export function setSessionCookie(
  res: NextResponse,
  token: string,
  maxAge: number,
  req: NextRequest,
  env: AppEnvironment,
) {
  res.cookies.set(cookieName(env), token, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax", // protège contre le CSRF (les requêtes cross-site ne reçoivent pas le cookie)
    path: "/",
    maxAge,
  });
  return res;
}

/** Supprime le cookie de session côté navigateur. */
export function clearSessionCookie(res: NextResponse, env: AppEnvironment) {
  res.cookies.set(cookieName(env), "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

/**
 * Défense CSRF en profondeur : sur les mutations, l'en-tête Origin (quand présent)
 * doit correspondre à l'hôte courant. SameSite=Lax constitue la protection principale.
 */
export function csrfOk(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return true;
  }
}
