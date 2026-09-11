-- Migration 0003 : lien élève <-> compte utilisateur (réconciliation annuaire)
-- Base locale uniquement. Idempotent.
ALTER TABLE "public"."students" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "demo"."students" ADD COLUMN IF NOT EXISTS "user_id" text;
