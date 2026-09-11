-- Affectations enseignant (multi-classes, multi-établissements)
-- Note : NULLS NOT DISTINCT (PG 15+) — un doublon (teacher, class, subject NULL) est refusé.
CREATE TABLE IF NOT EXISTS "teacher_establishment_assignments" (
  "id" text PRIMARY KEY,
  "teacher_id" text NOT NULL REFERENCES "teachers"("id"),
  "establishment_id" text NOT NULL REFERENCES "establishments"("id"),
  "status" text DEFAULT 'active',
  "created_at" text
);
CREATE TABLE IF NOT EXISTS "teacher_class_assignments" (
  "id" text PRIMARY KEY,
  "teacher_id" text NOT NULL REFERENCES "teachers"("id"),
  "class_id" text NOT NULL REFERENCES "classes"("id"),
  "subject_id" text REFERENCES "subjects"("id"),
  "school_year" text,
  "status" text DEFAULT 'active',
  "created_at" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_class_assignments_unique"
  ON "teacher_class_assignments" ("teacher_id","class_id","subject_id") NULLS NOT DISTINCT;