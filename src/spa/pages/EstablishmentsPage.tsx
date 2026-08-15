import { Landmark, MapPin, School } from "lucide-react";
import { CrudPage } from "../components/CrudPage";
import { LoadingRows, PageHeader, Pill, SectionCard } from "../components/ui-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useRows } from "../lib/data";
import { ESTABLISHMENT_TYPES, SCHOOL_YEAR, type Establishment, type Province } from "../lib/types";

export default function EstablishmentsPage() {
  const { session } = useAuth();
  const provinces = useRows<Province>("provinces", { order: "code", ascending: true });
  const establishments = useRows<Establishment>("establishments", { order: "name", ascending: true });
  const provinceById = new Map((provinces.data ?? []).map((p) => [p.id, p.name] as const));
  const perProvince = new Map<string, number>();
  for (const e of establishments.data ?? []) if (e.province_id) perProvince.set(e.province_id, (perProvince.get(e.province_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Établissements" subtitle="Structure territoriale : provinces du Gabon et établissements rattachés." />

      <SectionCard title="Établissement actif" description="Établissement sur lequel vous travaillez actuellement." icon={School}>
        {session?.establishment ? (
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone="primary">{session.establishment.name}</Pill>
            <span className="text-sm text-muted-foreground">{session.establishment.city ?? ""} · {session.establishment.type ?? ""}</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone="info">Administrateur de l'application</Pill>
            <span className="text-sm text-muted-foreground">
              Accès complet à tous les établissements — vous êtes le super administrateur et n'êtes rattaché à aucun établissement.
            </span>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Provinces du Gabon" description="Les 9 provinces servent de premier niveau de structuration." icon={MapPin}>
        {provinces.isLoading ? <LoadingRows /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Province</TableHead>
                  <TableHead>Chef-lieu</TableHead>
                  <TableHead>Établissements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(provinces.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Pill tone="info">{p.code}</Pill></TableCell>
                    <TableCell className="font-semibold">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.capital ?? "—"}</TableCell>
                    <TableCell>{perProvince.get(p.id) ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <CrudPage<Establishment>
        table="establishments"
        title="Liste des établissements"
        subtitle="Chaque établissement isole ses élèves, classes, notes et paiements."
        singular="Établissement"
        icon={Landmark}
        order="name"
        ascending
        searchable={(r) => `${r.name} ${r.code ?? ""} ${r.city ?? ""}`}
        fields={[
          { name: "name", label: "Nom", required: true },
          { name: "code", label: "Code" },
          { name: "province_id", label: "Province", type: "select", options: (provinces.data ?? []).map((p) => ({ value: p.id, label: p.name })) },
          { name: "city", label: "Ville" },
          { name: "type", label: "Type", type: "select", defaultValue: "mixte", options: Object.entries(ESTABLISHMENT_TYPES).map(([v, l]) => ({ value: v, label: l })) },
          { name: "director_name", label: "Directeur" },
          { name: "phone", label: "Téléphone", type: "tel" },
          { name: "email", label: "E-mail", type: "email" },
          { name: "address", label: "Adresse", type: "textarea", full: true },
          { name: "school_year", label: "Année scolaire", defaultValue: SCHOOL_YEAR },
          { name: "status", label: "Statut", type: "select", defaultValue: "actif", options: [{ value: "actif", label: "Actif" }, { value: "inactif", label: "Inactif" }] },
        ]}
        columns={[
          { header: "Établissement", render: (r) => <span className="font-semibold">{r.name}</span> },
          { header: "Code", render: (r) => r.code ?? "—" },
          { header: "Province", render: (r) => (r.province_id ? (provinceById.get(r.province_id) ?? "—") : "—") },
          { header: "Ville", render: (r) => r.city ?? "—" },
          { header: "Type", render: (r) => <Pill tone="primary">{ESTABLISHMENT_TYPES[r.type] ?? r.type}</Pill> },
          { header: "Statut", render: (r) => <Pill tone={r.status === "actif" ? "success" : "warning"}>{r.status}</Pill> },
        ]}
      />
    </div>
  );
}
