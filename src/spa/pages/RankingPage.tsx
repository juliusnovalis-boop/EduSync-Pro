import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { PageHeader, Pill, SectionCard, EmptyState } from "../components/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui";
import { useRows } from "../lib/data";
import { rankStudents } from "../lib/grades";
import { SCHOOL_YEAR, TERMS, TERM_KEYS, fullName, mention, type Grade, type SchoolClass, type Student, type Subject } from "../lib/types";

export default function RankingPage() {
  const students = useRows<Student>("students");
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const subjects = useRows<Subject>("subjects");
  const grades = useRows<Grade>("grades");
  const [classId, setClassId] = useState("all");
  const [term, setTerm] = useState("all");

  const ranked = useMemo(() => {
    const list = (students.data ?? []).filter((s) => classId === "all" || s.class_id === classId);
    return rankStudents(list, grades.data ?? [], subjects.data ?? [], term);
  }, [students.data, classId, grades.data, subjects.data, term]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Classement" subtitle="Classement pondéré des élèves par classe et par période." />
      <div className="mb-6 flex flex-wrap gap-3">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute l'année</SelectItem>
            {TERM_KEYS.map((t) => <SelectItem key={t} value={t}>{TERMS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <SectionCard title={`Classement — ${classId === "all" ? "Toutes classes" : (classes.data ?? []).find((c) => c.id === classId)?.name ?? ""}`} description={`Année scolaire ${SCHOOL_YEAR}`}>
        {ranked.length === 0 ? (
          <EmptyState icon={Trophy} title="Aucun classement" description="Aucune note pour ce filtre." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Rang</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Moyenne</TableHead>
                  <TableHead>Mention</TableHead>
                  <TableHead className="text-center">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((r) => (
                  <TableRow key={r.student.id}>
                    <TableCell>
                      <span className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${r.rank <= 3 ? "bg-warning/25 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>{r.rank}</span>
                    </TableCell>
                    <TableCell className="font-semibold">{fullName(r.student)}</TableCell>
                    <TableCell><span className="text-base font-extrabold">{r.moyenne.toFixed(2)}</span> <span className="text-xs text-muted-foreground">/20</span></TableCell>
                    <TableCell><Pill tone={r.moyenne >= 12 ? "success" : r.moyenne >= 10 ? "info" : "danger"}>{mention(r.moyenne)}</Pill></TableCell>
                    <TableCell className="text-center text-muted-foreground">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
