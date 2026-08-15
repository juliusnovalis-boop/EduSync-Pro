import { useMemo, useState } from "react";
import { BarChart3, Download, Printer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, SectionCard, StatCard } from "../components/ui-kit";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui";
import { useRows } from "../lib/data";
import { downloadCsv, toCsv } from "../lib/grades";
import { ATTENDANCE_STATUS, TERMS, TERM_KEYS, average, formatMoney, type Attendance, type Grade, type Payment, type SchoolClass, type Student, type Subject } from "../lib/types";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-4)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)"];

export default function ReportsPage() {
  const students = useRows<Student>("students");
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const subjects = useRows<Subject>("subjects", { order: "name", ascending: true });
  const grades = useRows<Grade>("grades");
  const attendance = useRows<Attendance>("attendance");
  const payments = useRows<Payment>("payments");
  const [term, setTerm] = useState("all");

  const studentRows = students.data ?? [];
  const allGrades = grades.data ?? [];
  const gradeRows = useMemo(() => (term === "all" ? allGrades : allGrades.filter((g) => g.term === term)), [allGrades, term]);
  const paymentRows = payments.data ?? [];
  const attendanceRows = attendance.data ?? [];
  const periodLabel = term === "all" ? "Toutes les périodes" : TERMS[term] ?? term;

  const general = average(gradeRows);
  const revenue = paymentRows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const presenceRate = attendanceRows.length ? (attendanceRows.filter((a) => a.status === "present").length / attendanceRows.length) * 100 : 0;

  const perClass = useMemo(
    () => (classes.data ?? []).map((c) => {
      const list = studentRows.filter((s) => s.class_id === c.id);
      const classGrades = gradeRows.filter((g) => list.some((s) => s.id === g.student_id));
      return { name: c.name, eleves: list.length, moyenne: Number(average(classGrades).toFixed(2)) };
    }),
    [classes.data, studentRows, gradeRows],
  );
  const perSubject = useMemo(
    () => (subjects.data ?? []).map((s) => ({ name: s.name, moyenne: Number(average(gradeRows.filter((g) => g.subject_id === s.id)).toFixed(2)) })).filter((r) => r.moyenne > 0),
    [subjects.data, gradeRows],
  );
  const genderSplit = useMemo(() => {
    const m = studentRows.filter((s) => s.gender === "M").length;
    return [{ name: "Garçons", value: m }, { name: "Filles", value: studentRows.length - m }].filter((r) => r.value > 0);
  }, [studentRows]);
  const attendanceSplit = useMemo(
    () => Object.entries(ATTENDANCE_STATUS).map(([k, l]) => ({ name: l, value: attendanceRows.filter((a) => a.status === k).length })).filter((r) => r.value > 0),
    [attendanceRows],
  );
  const revenueByMonth = useMemo(() => {
    const map = new Map<string, number>();
    paymentRows.forEach((p) => { const key = (p.date ?? "").slice(0, 7); if (!key) return; map.set(key, (map.get(key) ?? 0) + Number(p.amount || 0)); });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([month, total]) => ({ month, total }));
  }, [paymentRows]);
  const perTerm = useMemo(() => TERM_KEYS.map((t) => ({ name: TERMS[t] ?? t, moyenne: Number(average(allGrades.filter((g) => g.term === t)).toFixed(2)) })).filter((r) => r.moyenne > 0), [allGrades]);

  function exportCsv() {
    const content = toCsv(
      ["Période", "Section", "Libellé", "Valeur"],
      [
        ...perClass.flatMap((r): (string | number)[][] => [[periodLabel, "Effectifs par classe", r.name, r.eleves], [periodLabel, "Moyenne par classe", r.name, r.moyenne]]),
        ...perSubject.map((r): (string | number)[] => [periodLabel, "Moyenne par matière", r.name, r.moyenne]),
        ...revenueByMonth.map((r): (string | number)[] => [periodLabel, "Recettes par mois", r.month, r.total]),
        [periodLabel, "Synthèse", "Moyenne générale", general.toFixed(2)],
        [periodLabel, "Synthèse", "Taux de présence", `${presenceRate.toFixed(1)}%`],
        [periodLabel, "Synthèse", "Recettes totales", Math.round(revenue)],
      ],
    );
    downloadCsv(`rapports-${term}.csv`, content);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Rapports" subtitle={`Statistiques sur les résultats et l'assiduité — ${periodLabel}.`}
        action={<div className="flex gap-2 print:hidden"><Button variant="outline" onClick={exportCsv}><Download className="mr-2 size-4" /> Exporter</Button><Button onClick={() => window.print()}><Printer className="mr-2 size-4" /> Imprimer</Button></div>} />

      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <span className="text-sm font-medium text-muted-foreground">Période</span>
        <Select value={term} onValueChange={setTerm}><SelectTrigger className="w-56"><SelectValue placeholder="Période" /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les périodes</SelectItem>{TERM_KEYS.map((v) => <SelectItem key={v} value={v}>{TERMS[v]}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Élèves inscrits" value={studentRows.length} icon={BarChart3} tone="violet" />
        <StatCard label="Moyenne générale" value={`${general.toFixed(2)}/20`} icon={BarChart3} tone="green" />
        <StatCard label="Taux de présence" value={`${presenceRate.toFixed(1)}%`} icon={BarChart3} tone="amber" />
        <StatCard label="Recettes" value={formatMoney(revenue)} icon={BarChart3} tone="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Effectifs par classe" description="Nombre d'élèves inscrits" icon={BarChart3}>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={perClass}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip /><Bar dataKey="eleves" name="Élèves" fill="var(--chart-1)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </SectionCard>
        <SectionCard title="Moyennes par matière" description="Sur 20 points" icon={BarChart3}>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={perSubject}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="name" fontSize={12} /><YAxis domain={[0, 20]} fontSize={12} /><Tooltip /><Bar dataKey="moyenne" name="Moyenne" fill="var(--chart-4)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </SectionCard>
        <SectionCard title="Évolution par période" description="Paliers et trimestres" icon={BarChart3}>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={perTerm}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="name" fontSize={12} /><YAxis domain={[0, 20]} fontSize={12} /><Tooltip /><Line type="monotone" dataKey="moyenne" name="Moyenne" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
        </SectionCard>
        <SectionCard title="Recettes mensuelles" description="Paiements encaissés" icon={BarChart3}>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={revenueByMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} /><Bar dataKey="total" name="Recettes" fill="var(--chart-2)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </SectionCard>
        <SectionCard title="Répartition par genre" description="Effectifs" icon={BarChart3}>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={genderSplit} dataKey="value" nameKey="name" outerRadius={80} label>{genderSplit.map((e, i) => <Cell key={e.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Legend /><Tooltip /></PieChart></ResponsiveContainer></div>
        </SectionCard>
        <SectionCard title="Assiduité" description="Répartition des présences" icon={BarChart3}>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={attendanceSplit} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" /><XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="name" fontSize={12} width={70} /><Tooltip /><Bar dataKey="value" name="Pointages" fill="var(--chart-4)" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
        </SectionCard>
      </div>
    </div>
  );
}
