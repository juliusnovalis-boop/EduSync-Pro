import { NotebookPen } from "lucide-react";
import { CrudPage } from "../components/CrudPage";
import { Pill } from "../components/ui-kit";
import { useRows } from "../lib/data";
import type { Assignment, SchoolClass, Subject } from "../lib/types";

export default function AssignmentsPage() {
  const subjects = useRows<Subject>("subjects", { order: "name", ascending: true });
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const subjectById = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
  const classById = new Map((classes.data ?? []).map((c) => [c.id, c.name]));
  return (
    <CrudPage<Assignment>
      table="assignments"
      title="Devoirs"
      subtitle="Travaux à faire, compositions et échéances par classe et matière."
      singular="Devoir"
      icon={NotebookPen}
      order="due_date"
      searchable={(r) => `${r.title} ${subjectById.get(r.subject_id ?? "") ?? ""} ${classById.get(r.class_id ?? "") ?? ""}`}
      fields={[
        { name: "title", label: "Intitulé", required: true },
        { name: "subject_id", label: "Matière", type: "select", options: (subjects.data ?? []).map((s) => ({ value: s.id, label: s.name })) },
        { name: "class_id", label: "Classe", type: "select", options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
        { name: "due_date", label: "Date de remise", type: "date" },
        { name: "max_score", label: "Barème", type: "number", defaultValue: 20 },
        { name: "status", label: "Statut", type: "select", defaultValue: "ouvert", options: [{ value: "ouvert", label: "Ouvert" }, { value: "ferme", label: "Fermé" }] },
        { name: "description", label: "Consigne", type: "textarea", full: true },
      ]}
      columns={[
        { header: "Devoir", render: (r) => <span className="font-semibold">{r.title}</span> },
        { header: "Matière", render: (r) => subjectById.get(r.subject_id ?? "") ?? "—" },
        { header: "Classe", render: (r) => classById.get(r.class_id ?? "") ?? "—" },
        { header: "Échéance", render: (r) => r.due_date ?? "—" },
        { header: "Statut", render: (r) => <Pill tone={r.status === "ouvert" ? "success" : "muted"}>{r.status === "ouvert" ? "Ouvert" : "Fermé"}</Pill> },
      ]}
    />
  );
}
