import { ClipboardList } from "lucide-react";
import { CrudPage } from "../components/CrudPage";
import { ImportExport } from "../components/ImportExport";
import { Pill } from "../components/ui-kit";
import { useRows } from "../lib/data";
import { GRADE_TYPES, SCHOOL_YEAR, TERMS, fullName, type Grade, type SchoolClass, type Student, type Subject } from "../lib/types";

export default function GradesPage() {
  const students = useRows<Student>("students", { order: "last_name", ascending: true });
  const subjects = useRows<Subject>("subjects", { order: "name", ascending: true });
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const studentById = new Map((students.data ?? []).map((s) => [s.id, fullName(s)]));
  const subjectById = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
  return (
    <CrudPage<Grade>
      table="grades"
      title="Notes"
      subtitle="Évaluations notées sur 20, par matière et par période"
      singular="Note"
      icon={ClipboardList}
      order="date"
      toolbar={<ImportExport table="grades" filename="notes-edusync.csv" label="note(s)" columns={[
        { key: "student_id", label: "Élève ID" }, { key: "subject_id", label: "Matière ID" }, { key: "type", label: "Type" },
        { key: "value", label: "Note" }, { key: "max_value", label: "Barème" }, { key: "term", label: "Période" }, { key: "date", label: "Date" },
      ]} />}
      searchable={(r) => `${studentById.get(r.student_id) ?? ""} ${subjectById.get(r.subject_id) ?? ""} ${r.type}`}
      fields={[
        { name: "student_id", label: "Élève", type: "select", required: true, options: (students.data ?? []).map((s) => ({ value: s.id, label: fullName(s) })) },
        { name: "subject_id", label: "Matière", type: "select", required: true, options: (subjects.data ?? []).map((s) => ({ value: s.id, label: s.name })) },
        { name: "class_id", label: "Classe", type: "select", options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
        { name: "type", label: "Type", type: "select", defaultValue: "controle", options: Object.entries(GRADE_TYPES).map(([v, l]) => ({ value: v, label: l })) },
        { name: "value", label: "Note", type: "number", step: "0.25", required: true },
        { name: "max_value", label: "Barème", type: "number", defaultValue: 20 },
        { name: "term", label: "Période", type: "select", defaultValue: "T1", options: Object.entries(TERMS).map(([v, l]) => ({ value: v, label: l })) },
        { name: "school_year", label: "Année scolaire", defaultValue: SCHOOL_YEAR },
        { name: "date", label: "Date", type: "date", defaultValue: new Date().toISOString().slice(0, 10) },
        { name: "appreciation", label: "Appréciation", type: "textarea", full: true },
      ]}
      columns={[
        { header: "Élève", render: (r) => <span className="font-semibold">{studentById.get(r.student_id) ?? "—"}</span> },
        { header: "Matière", render: (r) => subjectById.get(r.subject_id) ?? "—" },
        { header: "Type", render: (r) => GRADE_TYPES[r.type] ?? r.type },
        { header: "Note", render: (r) => { const ratio = Number(r.value) / (Number(r.max_value) || 20); return <Pill tone={ratio >= 0.5 ? "success" : "danger"}>{r.value}/{r.max_value}</Pill>; } },
        { header: "Période", render: (r) => TERMS[r.term] ?? r.term },
        { header: "Date", render: (r) => r.date },
      ]}
    />
  );
}
