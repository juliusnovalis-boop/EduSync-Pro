import { Building2 } from "lucide-react";
import { CrudPage } from "../components/CrudPage";
import { Pill } from "../components/ui-kit";
import { useRows } from "../lib/data";
import { SCHOOL_YEAR, fullName, type SchoolClass, type Student, type Teacher } from "../lib/types";

export default function ClassesPage() {
  const teachers = useRows<Teacher>("teachers", { order: "last_name", ascending: true });
  const students = useRows<Student>("students");
  const teacherById = new Map((teachers.data ?? []).map((t) => [t.id, fullName(t)]));
  const counts = new Map<string, number>();
  for (const s of students.data ?? []) if (s.class_id) counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);
  return (
    <CrudPage<SchoolClass>
      table="classes"
      title="Classes"
      subtitle="Niveaux, salles, effectifs et professeurs principaux"
      singular="Classe"
      icon={Building2}
      order="name"
      ascending
      searchable={(r) => `${r.name} ${r.level} ${r.room ?? ""}`}
      fields={[
        { name: "name", label: "Nom de la classe", required: true },
        { name: "level", label: "Niveau", required: true },
        { name: "school_year", label: "Année scolaire", defaultValue: SCHOOL_YEAR },
        { name: "capacity", label: "Capacité", type: "number", defaultValue: 30 },
        { name: "room", label: "Salle" },
        { name: "main_teacher_id", label: "Professeur principal", type: "select", options: (teachers.data ?? []).map((t) => ({ value: t.id, label: fullName(t) })) },
      ]}
      columns={[
        { header: "Classe", render: (r) => <span className="font-semibold">{r.name}</span> },
        { header: "Niveau", render: (r) => <Pill tone="primary">{r.level}</Pill> },
        { header: "Salle", render: (r) => r.room ?? "—" },
        { header: "Effectif", render: (r) => `${counts.get(r.id) ?? 0} / ${r.capacity}` },
        { header: "Prof. principal", render: (r) => (r.main_teacher_id ? (teacherById.get(r.main_teacher_id) ?? "—") : "—") },
        { header: "Année", render: (r) => r.school_year },
      ]}
    />
  );
}
