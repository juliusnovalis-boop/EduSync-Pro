import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import {
  Button,
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui";
import { Pill } from "./ui-kit";
import { apiFetch } from "../lib/api";
import type { Teacher } from "../lib/types";

/**
 * Gestion des affectations d'un enseignant (modèle multi-établissements).
 * Un même compte enseignant peut être affecté à plusieurs établissements,
 * plusieurs classes et plusieurs matières — sans jamais créer un second compte.
 */
export function TeacherAssignmentsModal({ teacher, onClose }: { teacher: Teacher | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [estId, setEstId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const establishments = useQuery<{ id: string; name: string }[]>({ queryKey: ["establishments", "asc"], queryFn: async () => apiFetch(`/api/data/establishments?ascending=true&order=name`).then((r) => r.json()) });
  const classes = useQuery<{ id: string; name: string }[]>({ queryKey: ["classes", "asc"], queryFn: async () => apiFetch(`/api/data/classes?ascending=true`).then((r) => r.json()) });
  const subjects = useQuery<{ id: string; name: string }[]>({ queryKey: ["subjects", "asc"], queryFn: async () => apiFetch(`/api/data/subjects?ascending=true`).then((r) => r.json()) });

  const estAssignments = useQuery<{ id: string; teacher_id: string; establishment_id: string | null; status: string | null }[]>({
    queryKey: ["teacher_establishment_assignments"], enabled: !!teacher,
    queryFn: async () => apiFetch(`/api/data/teacher_establishment_assignments`).then((r) => r.json()),
  });
  const classAssignments = useQuery<{ id: string; teacher_id: string; class_id: string | null; subject_id: string | null; school_year: string | null }[]>({
    queryKey: ["teacher_class_assignments"], enabled: !!teacher,
    queryFn: async () => apiFetch(`/api/data/teacher_class_assignments`).then((r) => r.json()),
  });

  if (!teacher) return null;
  const nameOf = (list: { id: string; name: string }[] | undefined, id: string | null) => list?.find((x) => x.id === id)?.name ?? id ?? "—";
  const myEst = (estAssignments.data ?? []).filter((a) => a.teacher_id === teacher.id);
  const myClasses = (classAssignments.data ?? []).filter((a) => a.teacher_id === teacher.id);

  async function add(kind: "est" | "class") {
    try {
      if (kind === "est") {
        if (!estId) return;
        const res = await apiFetch("/api/data/teacher_establishment_assignments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacher_id: teacher!.id, establishment_id: estId, status: "active" }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
        setEstId("");
      } else {
        if (!classId) return;
        const res = await apiFetch("/api/data/teacher_class_assignments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacher_id: teacher!.id, class_id: classId, subject_id: subjectId || null, status: "active" }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
        setClassId(""); setSubjectId("");
      }
      toast.success("Affectation ajoutée");
      qc.invalidateQueries({ queryKey: ["teacher_establishment_assignments"] });
      qc.invalidateQueries({ queryKey: ["teacher_class_assignments"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(table: string, id: string) {
    try {
      const res = await apiFetch(`/api/data/${table}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
      toast.success("Affectation retirée");
      qc.invalidateQueries({ queryKey: [table] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={!!teacher} onOpenChange={(o) => !o && onClose()}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <DialogHeader>
                <DialogTitle>Affectations — {teacher.first_name} {teacher.last_name}</DialogTitle>
              </DialogHeader>
              <DialogDescription>Un même compte peut couvrir plusieurs établissements, classes et matières.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </div>

          <section className="mb-6">
            <h4 className="mb-2 text-sm font-semibold">🏫 Établissements ({myEst.length})</h4>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Select value={estId} onValueChange={setEstId}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Choisir un établissement…" /></SelectTrigger>
                <SelectContent>
                  {(establishments.data ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => add("est")} disabled={!estId}><Plus className="size-4" /> Affecter</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {myEst.length === 0 && <span className="text-sm text-muted-foreground">Aucun établissement affecté.</span>}
              {myEst.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1">
                  <Pill tone="primary">{nameOf(establishments.data, a.establishment_id)}</Pill>
                  <button onClick={() => remove("teacher_establishment_assignments", a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </span>
              ))}
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold">🎓 Classes ({myClasses.length})</h4>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Classe…" /></SelectTrigger>
                <SelectContent>
                  {(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Matière (optionnel)…" /></SelectTrigger>
                <SelectContent>
                  {(subjects.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => add("class")} disabled={!classId}><Plus className="size-4" /> Affecter</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {myClasses.length === 0 && <span className="text-sm text-muted-foreground">Aucune classe affectée.</span>}
              {myClasses.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1">
                  <Pill tone="info">{nameOf(classes.data, a.class_id)}{a.subject_id ? ` · ${nameOf(subjects.data, a.subject_id)}` : ""}</Pill>
                  <button onClick={() => remove("teacher_class_assignments", a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Dialog>
  );
}
