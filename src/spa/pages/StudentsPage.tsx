import { Users } from "lucide-react";
import { CrudPage } from "../components/CrudPage";
import { ImportExport } from "../components/ImportExport";
import { Pill } from "../components/ui-kit";
import { useRows } from "../lib/data";
import { SCHOOL_YEAR, fullName, type SchoolClass, type Student } from "../lib/types";

export default function StudentsPage() {
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const classOptions = (classes.data ?? []).map((i) => ({ value: i.id, label: i.name }));
  const classById = new Map((classes.data ?? []).map((i) => [i.id, i.name]));
  return (
    <CrudPage<Student>
      table="students"
      title="Élèves"
      subtitle="Répertoire des élèves inscrits dans l'établissement"
      singular="Élève"
      icon={Users}
      toolbar={<ImportExport table="students" filename="eleves-edusync.csv" label="élève(s)" columns={[
        { key: "first_name", label: "Prénom" }, { key: "last_name", label: "Nom" }, { key: "gender", label: "Genre" },
        { key: "birth_date", label: "Date naissance" }, { key: "matricule", label: "Matricule" }, { key: "class_id", label: "Classe ID" },
        { key: "parent_name", label: "Parent" }, { key: "parent_phone", label: "Téléphone" }, { key: "status", label: "Statut" },
      ]} />}
      searchable={(r) => `${r.first_name} ${r.last_name} ${r.matricule ?? ""} ${r.parent_name ?? ""}`}
      fields={[
        { name: "first_name", label: "Prénom", required: true },
        { name: "last_name", label: "Nom", required: true },
        { name: "gender", label: "Genre", type: "select", defaultValue: "M", options: [{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }] },
        { name: "birth_date", label: "Date de naissance", type: "date" },
        { name: "matricule", label: "Matricule" },
        { name: "class_id", label: "Classe", type: "select", options: classOptions },
        { name: "parent_name", label: "Nom du parent" },
        { name: "parent_phone", label: "Téléphone parent", type: "tel" },
        { name: "parent_email", label: "E-mail parent", type: "email" },
        { name: "school_year", label: "Année scolaire", defaultValue: SCHOOL_YEAR },
        { name: "status", label: "Statut", type: "select", defaultValue: "actif", options: [{ value: "actif", label: "Actif" }, { value: "suspendu", label: "Suspendu" }, { value: "transfere", label: "Transféré" }, { value: "diplome", label: "Diplômé" }] },
        { name: "address", label: "Adresse", type: "textarea", full: true },
      ]}
      columns={[
        { header: "Élève", render: (r) => <span className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{r.first_name.slice(0, 1)}{r.last_name.slice(0, 1)}</span><span><span className="block font-semibold">{fullName(r)}</span><span className="block text-xs text-muted-foreground">{r.matricule ?? "—"}</span></span></span> },
        { header: "Genre", render: (r) => (r.gender === "F" ? "Féminin" : "Masculin") },
        { header: "Classe", render: (r) => (r.class_id ? (classById.get(r.class_id) ?? "—") : "—") },
        { header: "Parent", render: (r) => <span><span className="block">{r.parent_name ?? "—"}</span><span className="block text-xs text-muted-foreground">{r.parent_phone ?? ""}</span></span> },
        { header: "Statut", render: (r) => <Pill tone={r.status === "actif" ? "success" : "warning"}>{r.status}</Pill> },
      ]}
    />
  );
}
