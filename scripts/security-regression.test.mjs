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

/* ============ PENTEST #10 — transverse (gitignore, secrets) ============ */

test("secrets : .env* ignoré par git, aucune clé de seme dans src", () => {
  assert.match(read(".gitignore"), /\.env\.\*/);
  const aiSrc = read("src/lib/server/ai.ts");
  assert.doesNotMatch(aiSrc, /AIza[0-9A-Za-z_-]{20}/, "aucune clé Gemini codée en dur");
  assert.doesNotMatch(aiSrc, /sk-or-/, "aucun token OpenRouter codé en dur");
});