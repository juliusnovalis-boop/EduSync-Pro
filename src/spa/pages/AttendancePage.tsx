import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard, StatCard } from "../components/ui-kit";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui";
import { useBulkInsert, useRows } from "../lib/data";
import { apiFetch } from "../lib/api";
import { ATTENDANCE_STATUS, fullName, type Attendance, type SchoolClass, type Student } from "../lib/types";

const STATUSES: { value: keyof typeof ATTENDANCE_STATUS; tone: string }[] = [
  { value: "present", tone: "bg-success text-success-foreground" },
  { value: "absent", tone: "bg-destructive text-destructive-foreground" },
  { value: "retard", tone: "bg-warning text-warning-foreground" },
  { value: "excuse", tone: "bg-info text-info-foreground" },
];

export default function AttendancePage() {
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const students = useRows<Student>("students", { order: "last_name", ascending: true });
  const attendance = useRows<Attendance>("attendance", { order: "date" });
  const bulk = useBulkInsert("attendance");
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(today);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const activeClass = classId || (classes.data ?? [])[0]?.id || "";
  const classStudents = useMemo(
    () => (students.data ?? []).filter((s) => s.class_id === activeClass),
    [students.data, activeClass],
  );

  const dayRecords = useMemo(
    () => (attendance.data ?? []).filter((a) => a.date === date && a.class_id === activeClass),
    [attendance.data, date, activeClass],
  );
  const existingByStudent = useMemo(() => {
    const m = new Map<string, Attendance>();
    dayRecords.forEach((r) => m.set(r.student_id, r));
    return m;
  }, [dayRecords]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { present: 0, absent: 0, retard: 0, excuse: 0 };
    classStudents.forEach((s) => {
      const st = statuses[s.id] ?? existingByStudent.get(s.id)?.status ?? "present";
      c[st] = (c[st] ?? 0) + 1;
    });
    return c;
  }, [classStudents, statuses, existingByStudent]);

  function statusOf(studentId: string) {
    return statuses[studentId] ?? existingByStudent.get(studentId)?.status ?? "present";
  }
  function setStatus(studentId: string, value: string) {
    setStatuses((prev) => ({ ...prev, [studentId]: value }));
  }

  async function save() {
    if (!activeClass) return toast.error("Choisissez une classe");
    const toCreate: Record<string, unknown>[] = [];
    const toUpdate: { id: string; values: Record<string, unknown> }[] = [];
    for (const s of classStudents) {
      const status = statusOf(s.id);
      const ex = existingByStudent.get(s.id);
      if (ex) toUpdate.push({ id: ex.id, values: { status, reason: status === "present" ? null : "Pointage" } });
      else toCreate.push({ student_id: s.id, class_id: activeClass, date, status, reason: status === "present" ? null : "Pointage" });
    }
    try {
      await Promise.all(toUpdate.map((u) => apiFetch(`/api/data/attendance/${u.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(u.values) })));
      if (toCreate.length) await bulk.mutateAsync(toCreate);
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Présences enregistrées");
      setStatuses({});
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Présences"
        subtitle="Pointez la présence des élèves par classe et par jour."
        action={<Button onClick={save} disabled={bulk.isPending}>Enregistrer le pointage</Button>}
      />

      <div className="mb-6 grid gap-5 sm:grid-cols-4">
        <StatCard label="Présents" value={counts.present} icon={CalendarCheck} tone="green" />
        <StatCard label="Absents" value={counts.absent} icon={CalendarCheck} tone="amber" />
        <StatCard label="Retards" value={counts.retard} icon={CalendarCheck} tone="blue" />
        <StatCard label="Excusés" value={counts.excuse} icon={CalendarCheck} tone="violet" />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Select value={activeClass} onValueChange={setClassId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>{(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
      </div>

      <SectionCard title={`Pointage — ${date}`} description={`${classStudents.length} élève(s)`}>
        {classStudents.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun élève dans cette classe.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Définir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classStudents.map((s) => {
                  const st = statusOf(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">{fullName(s)}</TableCell>
                      <TableCell><Pill tone={st === "present" ? "success" : st === "absent" ? "danger" : st === "retard" ? "warning" : "info"}>{ATTENDANCE_STATUS[st] ?? st}</Pill></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-center gap-1">
                          {STATUSES.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setStatus(s.id, opt.value)}
                              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${st === opt.value ? opt.tone : "bg-muted text-muted-foreground hover:bg-accent"}`}
                            >
                              {ATTENDANCE_STATUS[opt.value]}
                            </button>
                          ))}
                        </div>
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
