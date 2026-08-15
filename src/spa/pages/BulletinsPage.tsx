import { useMemo, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { PageHeader, Pill, SectionCard } from "../components/ui-kit";
import { Button } from "../components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui";
import { useRows } from "../lib/data";
import { buildBulletinLines, downloadCsv, rankStudents, toCsv, weightedAverage } from "../lib/grades";
import { SCHOOL_YEAR, TERMS, TERM_KEYS, fullName, mention, type Grade, type SchoolClass, type Student, type Subject } from "../lib/types";

export default function BulletinsPage() {
  const students = useRows<Student>("students");
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const subjects = useRows<Subject>("subjects", { order: "name", ascending: true });
  const grades = useRows<Grade>("grades");
  const [classId, setClassId] = useState("all");
  const [term, setTerm] = useState("T1");
  const [studentId, setStudentId] = useState("");

  const classStudents = useMemo(
    () => (students.data ?? []).filter((s) => classId === "all" || s.class_id === classId).sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [students.data, classId],
  );
  const student = classStudents.find((s) => s.id === studentId) ?? classStudents[0] ?? null;
  const schoolClass = (classes.data ?? []).find((c) => c.id === student?.class_id) ?? null;
  const lines = useMemo(() => (student ? buildBulletinLines(grades.data ?? [], subjects.data ?? [], student.id, term) : []), [student, subjects.data, grades.data, term]);
  const generale = weightedAverage(lines);
  const rank = useMemo(() => {
    if (!student) return { position: 0, total: 0 };
    const peers = (students.data ?? []).filter((s) => s.class_id === student.class_id);
    const scored = rankStudents(peers, grades.data ?? [], subjects.data ?? [], term);
    return { position: scored.find((r) => r.student.id === student.id)?.rank ?? 0, total: scored.length };
  }, [student, students.data, grades.data, subjects.data, term]);

  function exportCsv() {
    if (!student) return;
    const content = toCsv(
      ["Élève", "Classe", "Période", "Matière", "Notes", "Moyenne", "Coef.", "Points", "Appréciation"],
      [
        ...lines.map((l): (string | number)[] => [fullName(student), schoolClass?.name ?? "", TERMS[term] ?? term, l.subject.name, l.count, l.moyenne.toFixed(2), l.coefficient, l.points.toFixed(2), l.appreciation || mention(l.moyenne)]),
        [fullName(student), schoolClass?.name ?? "", TERMS[term] ?? term, "MOYENNE GÉNÉRALE", lines.reduce((s, l) => s + l.count, 0), generale.toFixed(2), "", "", mention(generale)],
      ],
    );
    downloadCsv(`bulletin-${term}-${student.last_name}-${student.first_name}.csv`, content);
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Bulletins"
        subtitle="Génération des bulletins par période (paliers P1–P5 ou trimestres)."
        action={student && lines.length > 0 ? (
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 size-4" /> Exporter</Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 size-4" /> Imprimer</Button>
          </div>
        ) : undefined}
      />
      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <Select value={classId} onValueChange={(v) => { setClassId(v); setStudentId(""); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={student?.id ?? ""} onValueChange={setStudentId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
          <SelectContent>{classStudents.map((s) => <SelectItem key={s.id} value={s.id}>{fullName(s)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{TERM_KEYS.map((t) => <SelectItem key={t} value={t}>{TERMS[t]}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!student ? (
        <SectionCard title="Bulletin" icon={FileText}><p className="py-12 text-center text-sm text-muted-foreground">Aucun élève disponible pour ce filtre.</p></SectionCard>
      ) : (
        <section className="surface-card p-8">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">EduSync Pro</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Bulletin de notes — {TERMS[term]}</h2>
              <p className="text-sm text-muted-foreground">Année scolaire {SCHOOL_YEAR}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-lg font-bold">{fullName(student)}</p>
              <p className="text-muted-foreground">Classe : {schoolClass?.name ?? "—"}</p>
              <p className="text-muted-foreground">Matricule : {student.matricule ?? "—"}</p>
            </div>
          </header>

          {lines.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Aucune note enregistrée pour cette période.</p>
          ) : (
            <>
              <div className="mt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matière</TableHead>
                      <TableHead className="text-center">Notes</TableHead>
                      <TableHead className="text-center">Moyenne</TableHead>
                      <TableHead className="text-center">Coef.</TableHead>
                      <TableHead className="text-center">Points</TableHead>
                      <TableHead>Appréciation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.subject.id}>
                        <TableCell className="font-semibold">{l.subject.name}</TableCell>
                        <TableCell className="text-center">{l.count}</TableCell>
                        <TableCell className="text-center font-bold">{l.moyenne.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{l.subject.coefficient}</TableCell>
                        <TableCell className="text-center">{(l.moyenne * Number(l.subject.coefficient || 1)).toFixed(2)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.appreciation || mention(l.moyenne)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-muted p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Moyenne générale</p>
                  <p className="mt-1 text-3xl font-extrabold">{generale.toFixed(2)}/20</p>
                </div>
                <div className="rounded-xl bg-muted p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rang</p>
                  <p className="mt-1 text-3xl font-extrabold">{rank.position > 0 ? `${rank.position}e` : "—"}<span className="text-base font-semibold text-muted-foreground">{rank.total ? ` / ${rank.total}` : ""}</span></p>
                </div>
                <div className="rounded-xl bg-muted p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mention</p>
                  <p className="mt-2"><Pill tone={generale >= 12 ? "success" : generale >= 10 ? "info" : "danger"}>{mention(generale)}</Pill></p>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
