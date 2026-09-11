-- =====================================================================
-- EduSync Pro — Migration 0004 : modèle multi-établissements
-- Base locale uniquement (127.0.0.1). Idempotent. Aucune donnée supprimée.
-- Objet :
--   • Index unique sur teacher_establishment_assignments (teacher_id, establishment_id)
--     → un même enseignant ne peut pas être affecté deux fois au même établissement,
--       mais PEUT être affecté à plusieurs établissements.
--   • parent_student_links_uidx existe déjà (plusieurs enfants OK, doublon interdit).
--   • teacher_class_assignments_unique existe déjà (teacher + classe + matière).
-- =====================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_establishment_assignments_unique"
  ON "public"."teacher_establishment_assignments" ("teacher_id", "establishment_id");

-- Réplique dans le schéma démo si la table y existe (ensureDemoSchema).
DO $$
BEGIN
  IF to_regclass('demo.teacher_establishment_assignments') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "teacher_establishment_assignments_unique"
      ON "demo"."teacher_establishment_assignments" ("teacher_id", "establishment_id")';
  END IF;
END $$;

-- Contrainte d'unicité teacher + classe + matière : NULLS NOT DISTINCT (PG 15+)
-- pour interdire aussi les doublons sans matière (subject_id NULL).
DROP INDEX IF EXISTS "public"."teacher_class_assignments_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_class_assignments_unique"
  ON "public"."teacher_class_assignments" ("teacher_id", "class_id", "subject_id") NULLS NOT DISTINCT;
