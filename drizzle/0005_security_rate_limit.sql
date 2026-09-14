-- =====================================================================
-- EduSync Pro — Migration 0005 : tables de RATE LIMITING / ANTI-BRUTE-FORCE
--
-- Rappel : les fonctions serverless Vercel sont sans état → les compteurs
-- ne vivent PAS en mémoire mais en base PostgreSQL (couche persistante).
-- Deux tables (répliquées aussi dans le schéma `demo` si présent) :
--   • rate_limit_buckets — compteurs fenêtrés (tentatives / email, / IP,
--     limites par endpoint sensible).
--   • account_lock — verrouillage progressif (exponential backoff).
-- Idempotent. Ne supprime aucune donnée.
-- NB : le code (src/lib/server/security/rate-limit.ts) auto-crée aussi ces
--      tables via ensureRateLimitSchema() ; cette migration garantit leur
--      présence en base dès le déploiement.
-- =====================================================================

CREATE TABLE IF NOT EXISTS "public"."rate_limit_buckets" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 0,
  "window_started_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."account_lock" (
  "key" text PRIMARY KEY,
  "attempts" integer NOT NULL DEFAULT 0,
  "locked_until" text NOT NULL,
  "updated_at" text NOT NULL
);

-- Réplique dans le schéma démo si la base de démo est présente.
DO $$
BEGIN
  IF to_regclass('demo.rate_limit_buckets') IS NULL AND to_regclass('public.rate_limit_buckets') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS "demo"."rate_limit_buckets" (LIKE "public"."rate_limit_buckets" INCLUDING ALL);
  END IF;
  IF to_regclass('demo.account_lock') IS NULL AND to_regclass('public.account_lock') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS "demo"."account_lock" (LIKE "public"."account_lock" INCLUDING ALL);
  END IF;
END $$;