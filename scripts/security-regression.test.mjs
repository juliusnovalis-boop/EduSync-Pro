// EduSync Pro — Tests de non-régression SÉCURITÉ (pentest).
// Exécution : npm run test:security  →  node --test scripts/security-regression.test.mjs
//
// Deux familles de tests :
//   A) Logique PURE (modules sans dépendance Next/DB) — testée en Node natif :
//      • CORS (allowlist stricte, jamais '*')  → src/lib/server/security/policy.ts
//      • Extraction IP client (chaîne de proxy) → policy.ts
//      • Rate limiting / anti-brute-force       → src/lib/server/security/rate-limit-core.ts
//   B) Contrats SOURCE statiques (verrouillent les correctifs en place) :
//      • endpoints durcis (login, settings, logout, register, ai/chat, audit, notifications)
//      • en-têtes de sécurité (vercel.json), robots/sitemap/security.txt
//      • version Next stable (pas de canary) + workflow CI + dependabot

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRODUCTION_ORIGIN,
  isAllowedOrigin,
  ipFromForwarded,
} from "../src/lib/server/security/policy.ts";
import {
  LoginRateLimiter,
  hit,
  lockDurationForAttempts,
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  emailBucketKey,
  accountLockKey,
  ipBucketKey,
  normalizeLoginKey,
} from "../src/lib/server/security/rate-limit-core.ts";
import {
  hashPassword,
  verifyPassword,
  isLegacySha256Hash,
  legacySha256,
  satisfiesPasswordPolicy,
  isKnownDefaultPassword,
} from "../src/lib/server/security/password.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const here = (...p) => path.join(ROOT, ...p);
const read = (...p) => fs.readFileSync(here(...p), "utf8");
const exists = (...p) => fs.existsSync(here(...p));

/* ------------------- Store mémoire (pour tests logiques) ------------------ */

function memoryStore() {
  const buckets = new Map();
  const locks = new Map();
  return {
    async ensureSchema() {},
    async getBucket(key) {
      return buckets.get(key);
    },
    async upsertBucket(key, count, windowStartedAtIso) {
      buckets.set(key, { count, window_started_at: windowStartedAtIso });
    },
    async getLock(key) {
      return locks.get(key);
    },
    async upsertLock(key, attempts, lockedUntilIso) {
      locks.set(key, { attempts, locked_until: lockedUntilIso });
    },
    async deleteAll(...keys) {
      for (const k of keys) {
        buckets.delete(k);
        locks.delete(k);
      }
    },
  };
}

const T0 = "2026-09-14T08:00:00.000Z";
const at = (offsetSec, base = T0) => new Date(Date.parse(base) + offsetSec * 1000).toISOString();
/* ===================== PENTEST #2 — CORS restreint ===================== */

test("CORS: origine de production exacte autorisée", () => {
  assert.equal(isAllowedOrigin(PRODUCTION_ORIGIN, false), true);
  assert.equal(isAllowedOrigin(PRODUCTION_ORIGIN, true), true);
});

test("CORS: jamais d'origine sauvage / null / '*'", () => {
  assert.equal(isAllowedOrigin(null, false), false);
  assert.equal(isAllowedOrigin("https://evil.example.com", false), false);
  assert.equal(isAllowedOrigin("https://evil.example.com", true), false);
  // Un origin '*' littéral ne doit jamais passer.
  assert.equal(isAllowedOrigin("*", false), false);
  assert.equal(isAllowedOrigin("https://*.vercel.app", false), false);
});

test("CORS: previews Vercel autorisées en dev uniquement", () => {
  assert.equal(isAllowedOrigin("https://edu-sync-pro-abc123.vercel.app", true), true);
  assert.equal(isAllowedOrigin("https://edu-sync-pro-abc123.vercel.app", false), false);
  // protocole http non accepté
  assert.equal(isAllowedOrigin("http://x.vercel.app", true), false);
});

/* ===================== PENTEST — Extraction IP cliente ================= */

test("IP: x-forwarded-for → premier élément (origine)", () => {
  assert.equal(ipFromForwarded("1.2.3.4, 10.0.0.1", null), "1.2.3.4");
  assert.equal(ipFromForwarded(" 203.0.113.7 , 10.0.0.1", "172.16.0.2"), "203.0.113.7");
  assert.equal(ipFromForwarded(null, "172.16.0.2"), "172.16.0.2");
  assert.equal(ipFromForwarded(null, null), "unknown");
});

/* ================= PENTEST #1 — Rate limiting / brute-force ============ */

test("Verrouillage progressif: 5→60s, 10→300s, 15→900s, cap", () => {
  assert.equal(lockDurationForAttempts(0), 0);
  assert.equal(lockDurationForAttempts(4), 0);
  assert.equal(lockDurationForAttempts(5), 60);
  assert.equal(lockDurationForAttempts(6), 60);
  assert.equal(lockDurationForAttempts(10), 300);
  assert.equal(lockDurationForAttempts(15), 900);
  assert.equal(lockDurationForAttempts(99), 900);
});

test("Clés de bucket normalisées (email insensible à la casse)", () => {
  assert.equal(normalizeLoginKey("  User@Example.COM "), "user@example.com");
  assert.equal(emailBucketKey("production", "User@X.com"), "login-email:production:user@x.com");
  assert.ok(accountLockKey("production", "u@x.com").startsWith("lock:production:"));
  assert.equal(ipBucketKey("1.2.3.4"), "login-ip:1.2.3.4");
});

test("hit(): fenêtre fixe — limite email 5/15min déclenche 429+Retry-After", async () => {
  const store = memoryStore();
  const limiter = new LoginRateLimiter(store, () => at(0));
  // 5 tentatives OK
  for (let i = 1; i <= 5; i++) {
    const r = await hit(store, emailBucketKey("production", "a@b.com"), LOGIN_EMAIL_LIMIT, at(0));
    assert.equal(r.allowed, true, `essai ${i} doit être autorisé`);
  }
  // 6e → bloqué
  const sixth = await hit(store, emailBucketKey("production", "a@b.com"), LOGIN_EMAIL_LIMIT, at(0));
  assert.equal(sixth.allowed, false);
  assert.ok(sixth.retryAfterSec > 0, "Retry-After > 0");
});

test("LoginRateLimiter.recordLoginAttempt: verrouillé après blocage + reset sur succès", async () => {
  const store = memoryStore();
  const limiter = new LoginRateLimiter(store, () => at(0));
  // 6 échecs consécutifs → verrouillage 1 min (5 échecs)
  for (let i = 0; i < 5; i++) {
    await limiter.recordLoginAttempt("production", "a@b.com", "1.2.3.4");
    await limiter.onLoginFailure("production", "a@b.com");
  }
  const inMemory = await limiter.checkAccountLock("production", "a@b.com");
  assert.equal(inMemory.locked, true);
  assert.ok(inMemory.retryAfterSec > 0);

  // Succès → réinitialisation complète, plus de verrou.
  await limiter.onLoginSuccess("production", "a@b.com", "1.2.3.4");
  const after = await limiter.checkAccountLock("production", "a@b.com");
  assert.equal(after.locked, false);
  const first = await limiter.recordLoginAttempt("production", "a@b.com", "1.2.3.4");
  assert.equal(first.status, "ok");
});

test("LoginRateLimiter: limite IP 10/15min → rate_limited à la 11e tentative", async () => {
  const store = memoryStore();
  const limiter = new LoginRateLimiter(store, () => at(0));
  // email différent mais même IP pour tester la limite IP
  for (let i = 1; i <= 10; i++) {
    const r = await limiter.recordLoginAttempt("production", `u${i}@x.com`, "9.9.9.9");
    assert.equal(r.status, "ok");
  }
  const r11 = await limiter.recordLoginAttempt("production", "u11@x.com", "9.9.9.9");
  assert.equal(r11.status, "rate_limited");
  assert.ok(r11.retryAfterSec > 0);
});

test("fenêtre expirée → le compteur se réinitialise", async () => {
  const store = memoryStore();
  const limiter = new LoginRateLimiter(store, () => at(0));
  for (let i = 0; i < 5; i++) await limiter.recordLoginAttempt("production", "a@b.com", "1.2.3.4");
  const blocked = await limiter.recordLoginAttempt("production", "a@b.com", "1.2.3.4");
  assert.equal(blocked.status, "rate_limited");
  // 16 minutes plus tard : fenêtre passée → de nouveau autorisé.
  const late = await hit(store, emailBucketKey("production", "a@b.com"), LOGIN_EMAIL_LIMIT, at(16 * 60));
  assert.equal(late.allowed, true);
});
/* ============== PENTEST #4 — plus de 500 sur body non-JSON ============= */

test("login : parsing sûr + 415/429 (pas de 500 sur form-urlencoded)", () => {
  const login = read("src/app/api/auth/login/route.ts");
  assert.match(login, /safeParseJson/);
  assert.doesNotMatch(login, /await req\.json\(\)/, "parsing jamais direct");
  assert.match(login, /loginRateLimiter\.recordLoginAttempt/);
  assert.match(login, /"Retry-After"/);
  assert.match(login, /internalErrorResponse/);
});

test("helpers http.ts : 415, erreur JSON générique, pas de fuite de message", () => {
  const http = read("src/lib/server/security/http.ts");
  assert.match(http, /jsonError\(415/);
  assert.match(http, /internalErrorResponse/);
  assert.doesNotMatch(http, /\(error as Error\)\.message/, "ne fuite pas le message brut en 500");
});

/* ========== PENTEST #3 — GET /api/settings protégé (pas de fuite) ======= */

test("settings : GET requiert l'authentification (idem PUT), aucun secret", () => {
  const settings = read("src/app/api/settings/route.ts");
  const beforePut = settings.slice(0, settings.indexOf("export async function PUT"));
  assert.match(beforePut, /requirePermission\(req, PERMISSIONS\.AI_CONFIGURE\)/);
  assert.doesNotMatch(settings, /GEMINI_API_KEY/, "la clé fournisseur ne doit pas apparaître dans la réponse");
});

/* ========== PENTEST #8 — logout sans auth ≠ ok:true ==================== */

test("logout : 204 idempotent si non connecté, jamais 'ok:true' sans session", () => {
  const logout = read("src/app/api/auth/logout/route.ts");
  assert.match(logout, /status: 204/);
  assert.match(logout, /verifySession/);
  const okIdx = logout.indexOf("ok: true");
  assert.ok(okIdx !== -1, "ok:true présent (chemin session trouvée)");
  assert.ok(logout.indexOf("verifySession") < okIdx, "ok:true émis uniquement après vérification de session");
});

/* ========== PENTEST #9 — register démo serveur-only ==================== */

test("register : garde ALLOW_PUBLIC_REGISTRATION (variable serveur, pas de header client)", () => {
  const reg = read("src/app/api/auth/register/route.ts");
  assert.match(reg, /process\.env\.ALLOW_PUBLIC_REGISTRATION/);
  assert.match(reg, /"true"/);
  assert.doesNotMatch(reg, /^.?(x-demo|edusync_env)/m, "ne dépend pas d'un header/cookie client");
});

/* ========== PENTEST #1 — rate limiting sur endpoints sensibles ========= */

test("endpoints sensibles : settings/ai-chat/audit/notifications limités par IP", () => {
  for (const file of [
    "src/app/api/settings/route.ts",
    "src/app/api/ai/chat/route.ts",
    "src/app/api/audit/route.ts",
    "src/app/api/notifications/route.ts",
  ]) {
    const s = read(file);
    assert.match(s, /checkEndpoint/, `${file} : rate limiting par IP présent`);
    assert.match(s, /ensureRateLimitSchema/, `${file} : schéma auto-créé`);
  }
});
/* ========== PENTEST #2/#5 — middleware CORS + en-têtes de sécurité ===== */

test("proxy (middleware Next 16) CORS centralisé (jamais '*')", () => {
  assert.ok(exists("src/proxy.ts"), "src/proxy.ts présent (convention Next 16)");
  const mw = read("src/proxy.ts");
  assert.match(mw, /applyCors/);
  assert.match(mw, /handlePreflight/);
  const cors = read("src/lib/server/security/cors.ts");
  assert.doesNotMatch(cors, /set\("Access-Control-Allow-Origin", "\*"\)/, "aucun wildcard CORS");
});

test("vercel.json : en-têtes de sécurité edge demandés par le pentest", () => {
  const j = JSON.parse(read("vercel.json"));
  const flat = JSON.stringify(j.headers);
  assert.match(flat, /"Content-Security-Policy"/);
  assert.match(flat, /frame-ancestors 'none'/);
  assert.match(flat, /script-src 'self' 'unsafe-inline'/);
  assert.match(flat, /"X-Frame-Options"/);
  assert.match(flat, /"DENY"/);
  assert.match(flat, /"X-Content-Type-Options"/);
  assert.match(flat, /"nosniff"/);
  assert.match(flat, /"Referrer-Policy"/);
  assert.match(flat, /"Permissions-Policy"/);
  assert.match(flat, /camera=\(\),\s*microphone=\(\),\s*geolocation=\(\)/);
  assert.ok(Array.isArray(j.regions) && j.regions.length > 0, "regions explicites");
  assert.doesNotMatch(flat, /Access-Control-Allow-Origin.*\*/);
});

/* ========== PENTEST #6 — robots / sitemap / security.txt =============== */

test("robots.txt : Disallow /api/ + Allow / (jamais /api en Allow)", () => {
  const rx = read("public/robots.txt");
  assert.match(rx, /User-agent: \*/);
  assert.match(rx, /Disallow: \/api\//);
  assert.match(rx, /Allow: \//);
  assert.doesNotMatch(rx, /Allow: \/api/);
});

test("sitemap.xml + security.txt présents", () => {
  assert.match(read("public/sitemap.xml"), /<urlset/);
  assert.match(read("public/.well-known/security.txt"), /Contact:/);
});

/* ============== PENTEST #7 — version Next stable, pas de canary ========= */

test("Next stable (>=16.2.6), jamais de canary en production", () => {
  const pkg = JSON.parse(read("package.json"));
  const v = pkg.dependencies?.next;
  assert.ok(v, "dépendance next présente");
  assert.doesNotMatch(v, /-canary/, "version instable (canary) interdite en production");
  const [maj, min] = String(v).replace(/^[\^~]/, "").split("-")[0].split(".").map(Number);
  assert.ok(maj > 16 || (maj === 16 && min >= 2), `Next doit être >= 16.2.x (obtenu ${v})`);
});

test("CI : job npm-audit + guard anti-canary + dependabot", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /npm-audit/);
  assert.match(ci, /npm audit/);
  assert.match(ci, /-canary/);
  assert.match(ci, /test:security/);
  assert.ok(exists(".github/dependabot.yml"), "dependabot activé");
  assert.match(read(".github/dependabot.yml"), /package-ecosystem: "npm"/);
});
/* ========= PENTEST #2 — F-16 / F-17 / F-18 / F-19 / F-20 / F-22 ======== */

test("F-17 (exécution) : scrypt salé, vérification correcte, migration legacy", async () => {
  const hash = await hashPassword("Correct-Horse-9");
  assert.match(hash, /^scrypt\$/, "format auto-descriptif scrypt$N$r$p$salt$hash");
  assert.notEqual(hash, await hashPassword("Correct-Horse-9"), "sel aléatoire par utilisateur");

  assert.equal((await verifyPassword("Correct-Horse-9", hash)).ok, true);
  assert.equal((await verifyPassword("Correct-Horse-9", hash)).needsRehash, false);
  assert.equal((await verifyPassword("mauvais", hash)).ok, false);

  const legacy = legacySha256("admin26");
  assert.equal(isLegacySha256Hash(legacy), true);
  const migrated = await verifyPassword("admin26", legacy);
  assert.equal(migrated.ok, true, "un compte legacy reste connectable (aucun verrouillage)");
  assert.equal(migrated.needsRehash, true, "le compte legacy doit être ré-haché en scrypt");
  assert.equal((await verifyPassword("autre", legacy)).ok, false);
});

test("F-17 : entrées dégradées \u2192 refus silencieux, jamais d'exception", async () => {
  assert.equal((await verifyPassword("x", null)).ok, false);
  assert.equal((await verifyPassword("x", undefined)).ok, false);
  assert.equal((await verifyPassword("x", "")).ok, false);
  assert.equal((await verifyPassword("x", "scrypt$corrompu")).ok, false);
  assert.equal((await verifyPassword("x", "scrypt$16384$8$1$!!$!!")).ok, false);
  assert.equal((await verifyPassword("x", "hash-inconnu")).ok, false);
});

test("F-17 : politique de mot de passe serveur (8\u2013128) et d\u00e9tection de fuite", () => {
  assert.equal(satisfiesPasswordPolicy("court"), false);
  assert.equal(satisfiesPasswordPolicy("motdepasse"), true);
  assert.equal(satisfiesPasswordPolicy("a".repeat(129)), false);
  assert.equal(isKnownDefaultPassword("admin26"), true, "secret historiquement fuit\u00e9");
  assert.equal(isKnownDefaultPassword("demo2026"), true);
  assert.equal(isKnownDefaultPassword("un-vrai-secret"), false);
});



/* ============ PENTEST #10 — transverse (gitignore, secrets) ============ */

test("secrets : .env* ignoré par git, aucune clé de seme dans src", () => {
  assert.match(read(".gitignore"), /\.env\.\*/);
  const aiSrc = read("src/lib/server/ai.ts");
  assert.doesNotMatch(aiSrc, /AIza[0-9A-Za-z_-]{20}/, "aucune clé Gemini codée en dur");
  assert.doesNotMatch(aiSrc, /sk-or-/, "aucun token OpenRouter codé en dur");
});
test("F-17 : aucune route ne hache plus un mot de passe en sha256 non salé", () => {
  for (const file of [
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/register/route.ts",
    "src/app/api/auth/users/route.ts",
    "src/app/api/auth/admin-password/route.ts",
  ]) {
    const src = read(file);
    assert.doesNotMatch(src, /password_hash\s*[:=]\s*sha256\(/, `${file} : hachage scrypt attendu`);
    assert.doesNotMatch(src, /sha256\([A-Za-z]+\)\s*!==\s*user\.password_hash/, `${file} : comparaison sha256 supprimée`);
  }
  const login = read("src/app/api/auth/login/route.ts");
  assert.match(login, /verifyPassword\(/, "login : vérification scrypt");
  assert.match(login, /check\.needsRehash/, "login : rehash transparent");
  assert.match(read("src/lib/server/ensure-defaults.ts"), /await hashPassword\(/, "amorçage : scrypt");
});

test("F-16/F-17 : aucun mot de passe par défaut codé en dur dans le dépôt", () => {
  const ensureDefaults = read("src/lib/server/ensure-defaults.ts");
  for (const secret of ["admin26", "demo2026", "teach2026", "stu2026"]) {
    assert.doesNotMatch(ensureDefaults, new RegExp(`"${secret}"`), `secret « ${secret} » toujours en dur`);
  }
  assert.doesNotMatch(read("src/lib/server/auth.ts"), /sha256\("admin26"\)/, "repli admin26 supprimé");
  assert.match(ensureDefaults, /SUPER_ADMIN_PASSWORD absent/, "avertissement explicite si non configuré");
  assert.match(ensureDefaults, /SEED_DEMO_ACCOUNTS/, "comptes démo sur opt-in explicite");
});

test("F-18 : le seed exige SYSTEM_MANAGE avant TOUTE écriture", () => {
  const seed = read("src/app/api/seed/route.ts");
  assert.match(seed, /requirePermission\(req, PERMISSIONS\.SYSTEM_MANAGE\)/);
  const gateIndex = seed.indexOf("requirePermission(req, PERMISSIONS.SYSTEM_MANAGE)");
  const firstWriteIndex = seed.indexOf("await wipeTable(");
  assert.ok(
    gateIndex > -1 && firstWriteIndex > -1 && gateIndex < firstWriteIndex,
    "autorisation vérifiée avant wipeTable/insert",
  );
  assert.match(seed, /if \("error" in auth\)/, "401/403 renvoyés sans exécuter le seed");
});

test("F-19 : l'identifiant brut n'est jamais journalisé dans l'audit", () => {
  const login = read("src/app/api/auth/login/route.ts");
  assert.match(login, /identifierFingerprint\(id\)/, "empreinte HMAC au lieu de l'identifiant brut");
  assert.doesNotMatch(login, /actor_id: id,/, "l'identifiant saisi n'est plus écrit tel quel");
  const auth = read("src/lib/server/auth.ts");
  assert.match(auth, /export function identifierFingerprint/);
  assert.match(auth, /createHmac\("sha256"/, "empreinte non réversible (HMAC)");
});

test("F-20 : verify-qr limité en débit, jeton validé, erreur générique", () => {
  const qr = read("src/app/api/verify-qr/[token]/route.ts");
  assert.match(qr, /checkEndpoint/, "rate limiting par IP");
  assert.match(qr, /ensureRateLimitSchema/, "schéma auto-créé");
  assert.match(qr, /SENSITIVE_ENDPOINT_LIMIT/);
  assert.match(qr, /QR_TOKEN_RE/, "validation de forme du jeton avant SQL");
  assert.match(qr, /internalErrorResponse/, "500 générique sans stack trace");
  assert.doesNotMatch(qr, /\(error as Error\)\.message/, "aucune fuite de message d'erreur interne");
  assert.match(qr, /no-store/, "réponse non mise en cache");
});

/* ==== Hygiène — règle .gitignore réellement active (CR parasite) ==== */

test("F-16 : la règle .vercel/ du .gitignore est réellement active", () => {
  // Défaut trouvé en re-pentest : un CR parasite fusionnait « # Vercel » et
  // « .vercel/ » en UNE seule ligne. Comme elle commençait par « # », git la
  // traitait comme un commentaire : la règle n'existait donc pas. Conséquence :
  // .vercel/project.json était committable par un simple `git add -A`, et
  // .vercel/.env.production.local (porteur de secrets) n'était couvert que
  // par ricochet via la règle `.env.*.local`.
  const gi = read(".gitignore");
  assert.match(gi, /^\.vercel\/\s*$/m, "règle .vercel/ présente sur sa propre ligne");
  assert.doesNotMatch(gi, /#\s*Vercel\r?\.vercel\//, "aucun CR ne fusionne le commentaire et la règle");
});

/* ==== PENTEST #2 (re-run) — F-23 : disponibilité (pooler PostgreSQL) ==== */

test("F-23 : les pools PostgreSQL sont bornés (max + timeouts)", () => {
  const db = read("src/db/index.ts");
  assert.match(db, /new Pool\(\{/, "construction du pool");
  assert.match(db, /max:\s*\d+/, "plafond `max` explicite par instance");
  assert.match(db, /idleTimeoutMillis:\s*\d+/, "libération des connexions inactives");
  assert.match(db, /connectionTimeoutMillis:\s*\d+/, "échec rapide au lieu de requêtes suspendues");
  const maxMatch = db.match(/max:\s*(\d+)/);
  assert.ok(maxMatch, "valeur de `max` lisible");
  // Deux pools par instance (production + démo) : le total doit rester sous la
  // capacité du pooler PostgreSQL (mode session, pool_size 15), sinon
  // EMAXCONNSESSION se reproduit et un burst concurrent provoque des 500.
  assert.ok(
    Number(maxMatch[1]) * 2 < 15,
    `max=${maxMatch[1]} × 2 pools doit rester < 15 (capacité du pooler)`,
  );
});

test("F-23 : ensureRateLimitSchema n'exécute plus le DDL à chaque requête", () => {
  const s = read("src/lib/server/security/rate-limit.ts");
  assert.match(s, /let rateLimitSchemaPromise/, "garde single-flight présente");
  assert.match(s, /if \(rateLimitSchemaPromise\) return rateLimitSchemaPromise/, "chemin chaud O(1)");
  assert.doesNotMatch(
    s,
    /export async function ensureRateLimitSchema\(\): Promise<void> \{\s*await postgresRateLimitStore\.ensureSchema\(\);/,
    "plus de CREATE TABLE sur chaque requête",
  );
});

test("F-23 : verify-qr répond 503 (fail-closed) si le limiteur est indisponible", () => {
  const qr = read("src/app/api/verify-qr/[token]/route.ts");
  assert.match(qr, /catch \(limiterError\)/, "bloc de garde dédié autour du limiteur");
  assert.match(qr, /status: 503/, "503 Service Unavailable au lieu d'un 500 opaque");
  assert.match(qr, /limiteur indisponible/, "cause journalisée côté serveur");
  assert.match(qr, /Retry-After/, "backoff explicite pour les clients");
  assert.match(qr, /checkEndpoint/, "le limiteur reste traversé (fail-closed, F-20 préservé)");
});

test("F-22 : le paramètre limit est borné (route ET moteur)", () => {
  const route = read("src/app/api/data/[table]/route.ts");
  assert.match(route, /const MAX_LIST_LIMIT = 500/, "plafond d'API explicite");
  assert.match(route, /Math\.min\(Math\.max\(Math\.trunc\(rawLimit\), 1\), MAX_LIST_LIMIT\)/);
  const data = read("src/lib/server/data.ts");
  assert.match(data, /const LIST_HARD_CAP = 5000/, "plafond dur du moteur de données");
  assert.doesNotMatch(data, /Math\.min\(Number\(limit\) \|\| 2000, 10000\)/, "ancien plafond 10000 supprimé");
});

test("F-7 : plus de repli « return rows » global (deny by default)", () => {
  const data = read("src/lib/server/data.ts");
  assert.match(data, /if \(!actor\) return \[\];/, "aucun acteur → aucune donnée");
  assert.doesNotMatch(data, /if \(!actor\) return rows;/, "ancien repli permissif supprimé");
  assert.doesNotMatch(data, /if \(table !== "students" && table !== "classes"\) return rows;/, "repli TEACHER supprimé");
  assert.match(data, /OWNER_COLUMNS\[table\]/, "propriété de ligne appliquée en LECTURE");
  assert.match(data, /requiredPermission\(table, "read"\) === null/, "repli borné par la matrice");
});

test("F-7 : matrice d'autorisation deny-by-default + anti-IDOR", () => {
  const policy = read("src/lib/server/data-policy.ts");
  assert.match(policy, /export const TABLE_POLICY/);
  assert.match(policy, /export const OWNER_COLUMNS/);
  assert.match(policy, /export function canWriteRow/);
  assert.match(policy, /roleRank\(actorRole\) >= roleRank\(ROLES\.ADMIN\)/);
  const list = read("src/app/api/data/[table]/route.ts");
  assert.match(list, /requiredPermission\(t, "read"\)/);
  assert.match(list, /requiredPermission\(t, "create"\)/);
  const one = read("src/app/api/data/[table]/[id]/route.ts");
  assert.match(one, /requiredPermission\(t, op\)/);
  assert.match(one, /canWriteRow/, "contrôle de propriété avant update/delete");
  assert.match(one, /if \(table === "students" \|\| table === "teachers"\)/, "tables gérées par route dédiée refusées");
});

test("F-16 : .env non suivi par git et ignoré (aucun secret dans le dépôt)", () => {
  assert.match(read(".gitignore"), /\.env/, ".gitignore couvre .env");
  const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".env.example"));
  assert.deepEqual(tracked, [], `fichiers .env encore suivis par git : ${tracked.join(", ")}`);
});


