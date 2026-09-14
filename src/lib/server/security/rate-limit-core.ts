/**
 * Moteur de rate limiting / anti-brute-force — EduSync Pro.
 *
 * Module PUR (aucune importation `@/db` ni `next/server`) : testable en Node
 * natif (tests de non-régression). La couche de persistance PostgreSQL vit dans
 * `rate-limit.ts` (store injectable, `RateLimitStore` ci-dessous).
 */

/* ----------------------------- Policy ---------------------------- */

/** Fenêtre (secondes) et plafond (nombre d'occurrences) d'un bucket. */
export interface LimitRule {
  limit: number;
  windowSec: number;
}

/** Politique de connexion (pentest #1). */
export const LOGIN_EMAIL_LIMIT: LimitRule = { limit: 5, windowSec: 15 * 60 };
export const LOGIN_IP_LIMIT: LimitRule = { limit: 10, windowSec: 15 * 60 };

/** Limite par IP par défaut pour les endpoints sensibles. */
export const SENSITIVE_ENDPOINT_LIMIT: LimitRule = { limit: 60, windowSec: 60 };
export const SETTINGS_ENDPOINT_LIMIT: LimitRule = { limit: 20, windowSec: 60 };

/** Verrouillage progressif : 5 échecs → 1 min ; 10 → 5 min ; 15 → 15 min ; cap 1 h. */
export function lockDurationForAttempts(attempts: number): number {
  const n = Math.max(0, Math.floor(attempts));
  if (n >= 15) return 15 * 60;
  if (n >= 10) return 5 * 60;
  if (n >= 5) return 1 * 60;
  return 0;
}

/* ------------------------- Interface du store ---------------------------- */

export interface BucketRow {
  count: number;
  window_started_at: string;
}

export interface LockRow {
  attempts: number;
  locked_until: string;
}

export interface RateLimitStore {
  ensureSchema(): Promise<void>;
  getBucket(key: string): Promise<BucketRow | undefined>;
  upsertBucket(key: string, count: number, windowStartedAtIso: string): Promise<void>;
  getLock(key: string): Promise<LockRow | undefined>;
  upsertLock(key: string, attempts: number, lockedUntilIso: string): Promise<void>;
  /** Supprime un bucket ET un lock (reset sur succès de connexion). */
  deleteAll(...keys: string[]): Promise<void>;
}

/* ------------------------- Clés de bucket normalisées --------------------- */

export function normalizeLoginKey(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function emailBucketKey(env: string, email: string): string {
  return `login-email:${env}:${normalizeLoginKey(email)}`;
}

export function accountLockKey(env: string, email: string): string {
  return `lock:${env}:${normalizeLoginKey(email)}`;
}

export function ipBucketKey(ip: string): string {
  return `login-ip:${ip}`;
}

/** Bucket générique pour un endpoint sensible (clé fournie par l'appelant). */
export function endpointBucketKey(namespace: string, ip: string): string {
  return `${namespace}:${ip}`;
}

/* ----------------------------- Moteur de comptage ------------------------ */

/** Résultat d'un « hit » sur un bucket fenêtré. */
export interface WindowResult {
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * Compte une occurrence dans un bucket à fenêtre FIXE (select + upsert sur la
 * même clé). Garanti centralisé sur la base partagée même en scale-out.
 */
export async function hit(
  store: RateLimitStore,
  key: string,
  rule: LimitRule,
  nowIso: string,
): Promise<WindowResult> {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return { allowed: true, retryAfterSec: 0 };
  const row = await store.getBucket(key);
  if (!row) {
    await store.upsertBucket(key, 1, nowIso);
    return { allowed: true, retryAfterSec: 0 };
  }
  const windowStart = Date.parse(row.window_started_at);
  if (!Number.isFinite(windowStart)) {
    await store.upsertBucket(key, 1, nowIso);
    return { allowed: true, retryAfterSec: 0 };
  }
  if (now - windowStart >= rule.windowSec * 1000) {
    // Fenêtre expirée → on repart de 1.
    await store.upsertBucket(key, 1, nowIso);
    return { allowed: true, retryAfterSec: 0 };
  }
  if (row.count >= rule.limit) {
    // Limite atteinte : temps restant avant la fin de la fenêtre.
    const retryAfterSec = Math.max(1, Math.ceil((windowStart + rule.windowSec * 1000 - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  await store.upsertBucket(key, row.count + 1, row.window_started_at);
  return { allowed: true, retryAfterSec: 0 };
}
export interface LoginAttemptResult {
  status: "ok" | "rate_limited" | "locked";
  retryAfterSec?: number;
}

/* --------------------------- Orchestrateur login -------------------------- */

/** Compteur des échecs consécutifs/verrouillage progressif d'un compte. */
export class LoginRateLimiter {
  private readonly store: RateLimitStore;
  private readonly now: () => string;

  constructor(store: RateLimitStore, now: () => string = () => new Date().toISOString()) {
    this.store = store;
    this.now = now;
  }

  /** Vérifie le verrouillage progressif d'un compte (avant toute vérification). */
  async checkAccountLock(
    env: string,
    email: string,
  ): Promise<{ locked: boolean; retryAfterSec: number }> {
    const lock = await this.store.getLock(accountLockKey(env, email));
    if (!lock) return { locked: false, retryAfterSec: 0 };
    const until = Date.parse(lock.locked_until);
    const nowMs = Date.parse(this.now());
    if (!Number.isFinite(until) || until <= nowMs) return { locked: false, retryAfterSec: 0 };
    return { locked: true, retryAfterSec: Math.ceil((until - nowMs) / 1000) };
  }

  /**
   * À appeler au DÉBUT de chaque tentative de connexion.
   * Compte la tentative (email + IP) et renvoie `ok`, `rate_limited` (429) ou
   * `locked` (verrouillage progressif actif).
   */
  async recordLoginAttempt(env: string, email: string, ip: string): Promise<LoginAttemptResult> {
    const nowIso = this.now();
    const lock = await this.checkAccountLock(env, email);
    if (lock.locked) {
      return { status: "locked", retryAfterSec: lock.retryAfterSec };
    }
    const emailHit = await hit(this.store, emailBucketKey(env, email), LOGIN_EMAIL_LIMIT, nowIso);
    if (!emailHit.allowed) {
      return { status: "rate_limited", retryAfterSec: emailHit.retryAfterSec };
    }
    const ipHit = await hit(this.store, ipBucketKey(ip), LOGIN_IP_LIMIT, nowIso);
    if (!ipHit.allowed) {
      return { status: "rate_limited", retryAfterSec: ipHit.retryAfterSec };
    }
    return { status: "ok" };
  }

  /** Mot de passe invalide : enregistre l'échec et éventuellement un verrou. */
  async onLoginFailure(env: string, email: string): Promise<{ retryAfterSec?: number }> {
    const key = accountLockKey(env, email);
    const lock = await this.store.getLock(key);
    const attempts = (lock?.attempts ?? 0) + 1;
    const duration = lockDurationForAttempts(attempts);
    const nowMs = Date.parse(this.now());
    let lockedUntilMs = lock ? Date.parse(lock.locked_until) : NaN;
    if (!Number.isFinite(lockedUntilMs)) lockedUntilMs = nowMs;
    if (lockedUntilMs < nowMs) lockedUntilMs = nowMs;
    const until = duration > 0 ? lockedUntilMs + duration * 1000 : lockedUntilMs;
    await this.store.upsertLock(key, attempts, new Date(until).toISOString());
    if (duration <= 0) return {};
    return { retryAfterSec: Math.max(1, Math.ceil((until - nowMs) / 1000)) };
  }

  /** Connexion réussie : réinitialise les compteurs (email + IP). */
  async onLoginSuccess(env: string, email: string, ip: string): Promise<void> {
    await this.store.deleteAll(emailBucketKey(env, email), accountLockKey(env, email), ipBucketKey(ip));
  }

  /** Limite générique par IP pour un endpoint sensible (settings, ai/chat, audit, notifications…). */
  async checkEndpoint(ip: string, namespace: string, rule: LimitRule): Promise<WindowResult> {
    return hit(this.store, endpointBucketKey(namespace, ip), rule, this.now());
  }
}