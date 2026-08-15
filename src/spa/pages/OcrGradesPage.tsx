import { useEffect, useMemo, useRef, useState } from "react";
import { ScanLine, Wand2, Upload, Loader2, ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard } from "../components/ui-kit";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui";
import { useBulkInsert, useRows } from "../lib/data";
import { GRADE_TYPES, SCHOOL_YEAR, TERMS, TERM_KEYS, fullName, type SchoolClass, type Student, type Subject } from "../lib/types";

export default function OcrGradesPage() {
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const subjects = useRows<Subject>("subjects", { order: "name", ascending: true });
  const students = useRows<Student>("students", { order: "last_name", ascending: true });
  const bulk = useBulkInsert("grades");

  const today = new Date().toISOString().slice(0, 10);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState("controle");
  const [term, setTerm] = useState("T1");
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [ocrAvailable, setOcrAvailable] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeClass = classId || (classes.data ?? [])[0]?.id || "";
  const classStudents = useMemo(() => (students.data ?? []).filter((s) => s.class_id === activeClass), [students.data, activeClass]);

  useEffect(() => {
    fetch("/api/ocr")
      .then((r) => r.json())
      .then((d: { available: boolean }) => setOcrAvailable(d.available))
      .catch(() => {});
  }, []);

  function onFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Veuillez sélectionner une image.");
    if (file.size > 4_000_000) return toast.error("Image trop volumineuse (max 4 Mo).");
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setValues({});
      toast.success("Image chargée", { description: "Cliquez sur « Scanner par IA » pour extraire les notes." });
    };
    reader.readAsDataURL(file);
  }

  async function scanWithAi() {
    if (!preview) return toast.error("Chargez d'abord une image de relevé de notes.");
    if (!activeClass) return toast.error("Choisissez une classe.");
    setScanning(true);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: activeClass, image: preview }),
      });
      const data = (await res.json()) as { grades?: { studentId: string; value: number }[]; error?: string; count?: number };
      if (!res.ok) throw new Error(data.error ?? "Échec du scan");
      const next: Record<string, string> = {};
      for (const g of data.grades ?? []) next[g.studentId] = String(g.value);
      setValues(next);
      toast.success(`${data.count ?? 0} note(s) détectée(s) par IA`, { description: "Vérifiez puis importez." });
    } catch (e) {
      toast.error("Scan IA échoué", { description: (e as Error).message });
    } finally {
      setScanning(false);
    }
  }

  function simulate() {
    const next: Record<string, string> = {};
    classStudents.forEach((s) => {
      const v = Math.max(4, Math.min(19.5, Math.round((8 + Math.random() * 10) * 4) / 4));
      next[s.id] = String(v);
    });
    setValues(next);
    toast.success("Scan simulé", { description: `${classStudents.length} notes générées (démo).` });
  }

  async function save() {
    if (!subjectId) return toast.error("Choisissez une matière");
    const rows: Record<string, unknown>[] = [];
    for (const s of classStudents) {
      const raw = values[s.id];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (Number.isNaN(value)) continue;
      rows.push({
        student_id: s.id,
        subject_id: subjectId,
        class_id: activeClass || null,
        type,
        value,
        max_value: 20,
        term,
        school_year: SCHOOL_YEAR,
        date,
        appreciation: value >= 16 ? "Excellent" : value >= 12 ? "Bien" : value >= 10 ? "Passable" : "Insuffisant",
      });
    }
    if (!rows.length) return toast.error("Aucune note à enregistrer");
    try {
      await bulk.mutateAsync(rows);
      toast.success(`${rows.length} note(s) importée(s)`);
      setValues({});
    } catch {
      toast.error("Erreur lors de l'import");
    }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Scan de copies"
        subtitle="Importez une photo de relevé de notes — l'IA extrait et pré-remplit les notes."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={simulate}><Wand2 className="mr-2 size-4" /> Simuler</Button>
            <Button onClick={save} disabled={bulk.isPending}>Importer les notes</Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={activeClass} onValueChange={(v) => { setClassId(v); setValues({}); }}>
          <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>{(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger><SelectValue placeholder="Matière" /></SelectTrigger>
          <SelectContent>{(subjects.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(GRADE_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TERM_KEYS.map((t) => <SelectItem key={t} value={t}>{TERMS[t]}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Image du relevé" description="Photo d'une feuille de notes (JPG/PNG, max 4 Mo)" icon={Upload}>
          <div
            className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 text-center transition hover:border-primary hover:bg-accent/50"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
          >
            {preview ? (
              <div className="w-full">
                <img src={preview} alt="Aperçu" className="mx-auto max-h-[240px] rounded-lg border border-border object-contain" />
                <p className="mt-2 text-xs text-muted-foreground">Cliquer pour remplacer l'image</p>
              </div>
            ) : (
              <>
                <ImageIcon className="size-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Glissez une image ici ou cliquez pour parcourir</p>
                <p className="mt-1 text-xs text-muted-foreground">L'IA lira les noms et notes automatiquement</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={scanWithAi} disabled={!preview || scanning || !ocrAvailable}>
              {scanning ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              {scanning ? "Scan en cours…" : "Scanner par IA"}
            </Button>
            {ocrAvailable ? (
              <Pill tone="success"><Sparkles className="mr-1 size-3" /> OCR IA disponible</Pill>
            ) : (
              <Pill tone="muted"><ScanLine className="mr-1 size-3" /> OCR IA non configuré</Pill>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Notes détectées" description={`${Object.keys(values).length} note(s) pré-remplie(s) sur ${classStudents.length} élève(s)`}>
          <div className="flex h-full min-h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
            {Object.keys(values).length > 0 ? (
              <div>
                <p className="font-bold text-foreground">{Object.keys(values).length} note(s) détectée(s)</p>
                <p className="mt-1">Vérifiez le tableau ci-dessous puis cliquez sur « Importer les notes ».</p>
              </div>
            ) : (
              <div>
                <ScanLine className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-3">Chargez une image et lancez le scan IA, ou utilisez la simulation.</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Saisie / vérification des notes" description="Modifiez les valeurs avant import (sur 20)">
        {classStudents.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun élève dans cette classe.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead className="w-40">Note /20</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classStudents.map((s) => {
                  const filled = values[s.id] !== undefined && values[s.id] !== "";
                  return (
                    <TableRow key={s.id} className={filled ? "bg-success/5" : ""}>
                      <TableCell className="font-semibold">{fullName(s)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.25"
                          min={0}
                          max={20}
                          value={values[s.id] ?? ""}
                          onChange={(e) => setValues((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          className="w-32"
                          placeholder="—"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
