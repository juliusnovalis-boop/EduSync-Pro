import { useMemo, useState } from "react";
import { FolderOpen, Search, FileText, Award, Receipt } from "lucide-react";
import { PageHeader, Pill, LoadingRows, EmptyState } from "../components/ui-kit";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui";
import { useRows, useDeleteRow } from "../lib/data";
import { fullName, type DigitalDocument, type Student } from "../lib/types";

const DOC_ICON: Record<string, typeof FileText> = { certificat: Award, attestation: FileText, recu: Receipt };
const DOC_LABEL: Record<string, string> = { certificat: "Certificat", attestation: "Attestation", recu: "Reçu de paiement" };

export default function DocumentsPage() {
  const docs = useRows<DigitalDocument>("digital_documents", { order: "created_at" });
  const students = useRows<Student>("students");
  const remove = useDeleteRow("digital_documents", "Document");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const studentById = new Map((students.data ?? []).map((s) => [s.id, fullName(s)]));

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (docs.data ?? []).filter((d) => {
      const matchType = typeFilter === "all" || d.type === typeFilter;
      const matchQuery = !term || d.title.toLowerCase().includes(term) || (studentById.get(d.student_id ?? "") ?? "").toLowerCase().includes(term);
      return matchType && matchQuery;
    });
  }, [docs.data, query, typeFilter, studentById]);

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader title="Documents numériques" subtitle="Bibliothèque des documents générés : certificats, attestations, reçus." />

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." className="rounded-full bg-muted pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="certificat">Certificats</SelectItem>
              <SelectItem value="attestation">Attestations</SelectItem>
              <SelectItem value="recu">Reçus</SelectItem>
            </SelectContent></Select>
          <span className="text-sm text-muted-foreground">{filtered.length} document(s)</span>
        </div>

        {docs.isLoading ? (
          <div className="p-6"><LoadingRows /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Aucun document" description="Générez des documents depuis le Document Studio." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Élève</TableHead>
                <TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((d) => {
                  const Icon = DOC_ICON[d.type] ?? FileText;
                  return (
                    <TableRow key={d.id}>
                      <TableCell><span className="flex items-center gap-2"><Icon className="size-4 text-primary" /><span className="font-semibold">{d.title}</span></span></TableCell>
                      <TableCell><Pill tone="info">{DOC_LABEL[d.type] ?? d.type}</Pill></TableCell>
                      <TableCell>{d.student_id ? (studentById.get(d.student_id) ?? "—") : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(d.created_at).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="text-right"><button className="text-xs text-destructive hover:underline" onClick={() => remove.mutate(d.id)}>Supprimer</button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
