import { Link } from "react-router-dom";
import { Users, GraduationCap, TrendingUp, CalendarCheck, Award, BookOpen, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, SectionCard, StatCard } from "../components/ui-kit";
import { useRows } from "../lib/data";
import { TERMS, TERM_KEYS, average, formatMoney, fullName, type Attendance, type Grade, type Payment, type SchoolClass, type Student, type Subject, type Teacher } from "../lib/types";

export default function DashboardPage() {
  const students = useRows<Student>("students");
  const teachers = useRows<Teacher>("teachers");
  const subjects = useRows<Subject>("subjects");
  const classes = useRows<SchoolClass>("classes");
  const grades = useRows<Grade>("grades");
  const attendance = useRows<Attendance>("attendance");
  const payments = useRows<Payment>("payments");

  const allGrades = grades.data ?? [];
  const allAttendance = attendance.data ?? [];
  const generalAverage = average(allGrades);
  const presenceRate = allAttendance.length
    ? Math.round((allAttendance.filter((a) => a.status === "present").length / allAttendance.length) * 100)
    : 0;
  const revenue = (payments.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);

  const perSubject = (subjects.data ?? [])
    .map((s) => ({ name: s.name, moyenne: Number(average(allGrades.filter((g) => g.subject_id === s.id)).toFixed(2)) }))
    .filter((r) => r.moyenne > 0);
  const perTerm = TERM_KEYS.map((term) => ({ name: TERMS[term] ?? term, moyenne: Number(average(allGrades.filter((g) => g.term === term)).toFixed(2)) })).filter((r) => r.moyenne > 0);
  const recentStudents = (students.data ?? []).slice(0, 6);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de votre établissement scolaire" />
      {(students.isError || teachers.isError || grades.isError || attendance.isError) && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Impossible de charger certaines données ({String((students.error || teachers.error || grades.error || attendance.error as Error)?.message ?? "erreur inconnue")}). Vérifiez votre connexion/session, puis rechargez la page.
        </div>
      )}
      {(students.isLoading || teachers.isLoading) && (
        <div className="mb-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Chargement des données de l'établissement…</div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Élèves inscrits" value={students.data?.length ?? 0} icon={Users} tone="violet" hint={`${classes.data?.length ?? 0} classe(s)`} />
        <StatCard label="Enseignants" value={teachers.data?.length ?? 0} icon={GraduationCap} tone="blue" hint={`${subjects.data?.length ?? 0} matière(s)`} />
        <StatCard label="Moyenne générale" value={generalAverage.toFixed(2)} icon={TrendingUp} tone="green" hint={`${allGrades.length} note(s) saisie(s)`} />
        <StatCard label="Taux de présence" value={`${presenceRate}%`} icon={CalendarCheck} tone="amber" hint={`${allAttendance.length} pointage(s)`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard title="Performance par matière" description="Moyennes calculées sur toutes les évaluations" icon={Award} className="lg:col-span-2">
          {perSubject.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={perSubject}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis domain={[0, 20]} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="moyenne" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 rounded-full bg-muted" />)}
              <p className="pt-2 text-sm text-muted-foreground">Aucune note enregistrée pour le moment.</p>
            </div>
          )}
        </SectionCard>
        <SectionCard title="Récents" description="Derniers élèves inscrits" icon={BookOpen}>
          {recentStudents.length ? (
            <ul className="space-y-3">
              {recentStudents.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{s.first_name.slice(0, 1)}{s.last_name.slice(0, 1)}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{fullName(s)}</span><span className="block text-xs text-muted-foreground">{s.matricule || "Sans matricule"}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucun élève — <Link to="/students" className="font-semibold text-primary underline-offset-4 hover:underline">en ajouter un</Link></p>
          )}
        </SectionCard>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard title="Progression par période" description="Comparaison des moyennes entre périodes" icon={TrendingUp} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={perTerm}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis domain={[0, 20]} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="moyenne" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="Recettes" description="Total des paiements enregistrés" icon={Wallet}>
          <p className="text-3xl font-extrabold tracking-tight">{formatMoney(revenue)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{(payments.data ?? []).length} transaction(s)</p>
          <Link to="/payments" className="mt-5 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">Voir les paiements</Link>
        </SectionCard>
      </div>
    </div>
  );
}
