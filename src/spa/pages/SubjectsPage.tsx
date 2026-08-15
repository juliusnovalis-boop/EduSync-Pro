import { BookOpen } from "lucide-react";
import { CrudPage } from "../components/CrudPage";
import { Pill } from "../components/ui-kit";
import type { Subject } from "../lib/types";

export default function SubjectsPage() {
  return (
    <CrudPage<Subject>
      table="subjects"
      title="Matières"
      subtitle="Catalogue des matières et coefficients"
      singular="Matière"
      icon={BookOpen}
      order="name"
      ascending
      searchable={(r) => `${r.name} ${r.code ?? ""} ${r.level ?? ""}`}
      fields={[
        { name: "name", label: "Nom", required: true },
        { name: "code", label: "Code" },
        { name: "coefficient", label: "Coefficient", type: "number", defaultValue: 1, step: "0.5" },
        { name: "level", label: "Niveau" },
        { name: "color", label: "Couleur (hex)", defaultValue: "#7c3aed" },
      ]}
      columns={[
        { header: "Matière", render: (r) => <span className="flex items-center gap-3"><span className="size-3 rounded-full" style={{ backgroundColor: r.color || "#7c3aed" }} /><span className="font-semibold">{r.name}</span></span> },
        { header: "Code", render: (r) => r.code ?? "—" },
        { header: "Coefficient", render: (r) => <Pill tone="primary">×{r.coefficient}</Pill> },
        { header: "Niveau", render: (r) => r.level ?? "Tous" },
      ]}
    />
  );
}
