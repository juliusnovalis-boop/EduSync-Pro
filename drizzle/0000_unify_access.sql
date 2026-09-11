-- =====================================================================
-- EduSync Pro — Migration 0000 : Unification « Gestion des accès ↔ Répertoire »
-- =====================================================================
-- Objet   : créer la liaison explicite compte utilisateur → fiche métier.
-- Tables  : students (user_id), teachers (user_id).
--
-- Pourquoi :
--   • students et teachers n'avaient AUCUNE relation vers app_users.
--   • Le compte (GESTION DES ACCÈS) doit devenir la source de l'identité ;
--     le répertoire (fiche métier) s'y rattache via user_id.
--
-- SÉCURITÉ / CONSIGNES :
--   • Colonnes NULLABLE pour préserver les fiches historiques (JAMAIS supprimées).
--   • NE PAS exécuter tant que DATABASE_URL de production n'est pas confirmée
--     accessible. Application manuelle (psql) ou drizzle-kit migrate ultérieure.
--   • Les fiches orphelines existantes resteront accessibles et marquées
--     « À réconcilier » côté applicatif.
-- =====================================================================

-- 1) students.user_id — nullable (préserve l'existant), UNIQUE (1 compte → 1 fiche), FK → app_users.id
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "user_id" text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_user_id_unique') THEN
    ALTER TABLE "students" ADD CONSTRAINT "students_user_id_unique" UNIQUE ("user_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_user_id_fk') THEN
    ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "app_users"("id");
  END IF;
END $$;

-- 2) teachers.user_id — nullable, FK → app_users.id
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "user_id" text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_user_id_fk') THEN
    ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "app_users"("id");
  END IF;
END $$;