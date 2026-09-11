import { useState } from "react";
import { GraduationCap, Network } from "lucide-react";
import { Button } from "../components/ui";
import { CrudPage } from "../components/CrudPage";
import { TeacherAssignmentsModal } from "../components/TeacherAssignmentsModal";
import { Pill } from "../components/ui-kit";
import { fullName, type Teacher } from "../lib/types";

export default function TeachersPage() {
  const [assignmentsFor, setAssignmentsFor] = useState<Teacher | null>(null);
  return (
    <>
      <CrudPage<Teacher>
        table="teachers"
        title="Enseignants"
        subtitle="Équipe pédagogique et matières enseignées"
        singular="Enseignant"
        icon={GraduationCap}
        createBlocked="La création d'un enseignant (compte + fiche) se fait via Gestion des accès."
        searchable={(r) => `${r.first_name} ${r.last_name} ${r.email ?? ""}`}
        fields={[
          { name: "first_name", label: "Prénom", required: true },
          { name: "last_name", label: "Nom", required: true },
          { name: "gender", label: "Genre", type: "select", defaultValue: "M", options: [{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }] },
          { name: "email", label: "E-mail", type: "email" },
          { name: "phone", label: "Téléphone", type: "tel" },
          { name: "hire_date", label: "Date d'embauche", type: "date" },
          { name: "status", label: "Statut", type: "select", defaultValue: "actif", options: [{ value: "actif", label: "Actif" }, { value: "conge", label: "En congé" }, { value: "inactif", label: "Inactif" }] },
          { name: "subject_names", label: "Matières (séparées par des virgules)", type: "list", full: true },
        ]}
        columns={[
          { header: "Enseignant", render: (r) => <span className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-info/12 text-xs font-bold text-info">{r.first_name.slice(0, 1)}{r.last_name.slice(0, 1)}</span><span className="font-semibold">{fullName(r)}</span></span> },
          { header: "Matières", render: (r) => <span className="flex flex-wrap gap-1">{(r.subject_names ?? []).length ? (r.subject_names ?? []).map((n) => <Pill key={n} tone="primary">{n}</Pill>) : <span className="text-muted-foreground">—</span>}</span> },
          { header: "Contact", render: (r) => <span><span className="block">{r.email ?? "—"}</span><span className="block text-xs text-muted-foreground">{r.phone ?? ""}</span></span> },
          { header: "Compte", render: (r) => (r.user_id ? <Pill tone="success">Compte lié</Pill> : <Pill tone="warning">À réconcilier</Pill>) },
          { header: "Affectations", render: (r) => <Button variant="outline" size="sm" onClick={() => setAssignmentsFor(r)}><Network className="size-3.5" /> Établissements / classes</Button> },
          { header: "Embauche", render: (r) => r.hire_date ?? "—" },
          { header: "Statut", render: (r) => <Pill tone={r.status === "actif" ? "success" : "warning"}>{r.status}</Pill> },
        ]}
      />
      <TeacherAssignmentsModal teacher={assignmentsFor} onClose={() => setAssignmentsFor(null)} />
    </>
  );
}
