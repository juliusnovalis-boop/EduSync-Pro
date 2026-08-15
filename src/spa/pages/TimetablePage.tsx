import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader, SectionCard } from "../components/ui-kit";
import { Button, Dialog, DialogCloseButton, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui";
import { useDeleteRow, useRows, useSaveRow } from "../lib/data";
import { DAYS, fullName, type CourseSession, type SchoolClass, type Subject, type Teacher } from "../lib/types";

export default function TimetablePage() {
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const subjects = useRows<Subject>("subjects", { order: "name", ascending: true });
  const teachers = useRows<Teacher>("teachers", { order: "last_name", ascending: true });
  const sessions = useRows<CourseSession>("course_sessions", { order: "start_time", ascending: true });
  const saveSession = useSaveRow("course_sessions", "Cours");
  const deleteSession = useDeleteRow("course_sessions", "Cours");

  const [classId, setClassId] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject_id: "", teacher_id: "", day_of_week: "1", start_time: "08:00", end_time: "09:00", room: "" });

  const activeClass = classId || (classes.data ?? [])[0]?.id || "";
  const subjectById = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  const teacherById = new Map((teachers.data ?? []).map((t) => [t.id, t]));

  const byDay = useMemo(() => {
    const m = new Map<number, CourseSession[]>();
    DAYS.forEach((_, i) => m.set(i + 1, []));
    (sessions.data ?? []).filter((s) => s.class_id === activeClass).forEach((s) => m.get(s.day_of_week)?.push(s));
    for (const list of m.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return m;
  }, [sessions.data, activeClass]);

  function submit() {
    if (!activeClass) return;
    saveSession.mutate(
      { values: { class_id: activeClass, subject_id: form.subject_id || null, teacher_id: form.teacher_id || null, day_of_week: Number(form.day_of_week), start_time: form.start_time, end_time: form.end_time, room: form.room || null } },
      { onSuccess: () => { setOpen(false); setForm({ ...form, subject_id: "", teacher_id: "", room: "" }); } },
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Emploi du temps"
        subtitle="Planification hebdomadaire des cours par classe."
        action={<Button disabled={!activeClass} onClick={() => setOpen(true)}><Plus className="mr-2 size-4" /> Nouveau cours</Button>}
      />

      <div className="mb-6">
        <Select value={activeClass} onValueChange={setClassId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>{(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DAYS.map((day, i) => {
          const list = byDay.get(i + 1) ?? [];
          return (
            <SectionCard key={day} title={day} description={`${list.length} cours`}>
              {list.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Aucun cours.</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((s) => {
                    const subj = s.subject_id ? subjectById.get(s.subject_id) : null;
                    return (
                      <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                        <span className="flex size-3 rounded-full" style={{ backgroundColor: subj?.color || "#7c3aed" }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{subj?.name ?? "—"}</span>
                          <span className="block text-xs text-muted-foreground">{s.start_time} – {s.end_time}{s.room ? ` · ${s.room}` : ""}{s.teacher_id ? ` · ${fullName(teacherById.get(s.teacher_id) ?? { first_name: "", last_name: "" })}` : ""}</span>
                        </span>
                        <button className="rounded-md p-1 text-muted-foreground hover:bg-accent" onClick={() => deleteSession.mutate(s.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <div>
          <DialogCloseButton onClick={() => setOpen(false)} />
          <DialogHeader><DialogTitle>Ajouter un cours</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Matière</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{(subjects.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Enseignant</Label>
              <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{(teachers.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{fullName(t)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Jour</Label>
              <Select value={form.day_of_week} onValueChange={(v) => setForm({ ...form, day_of_week: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DAYS.map((d, idx) => <SelectItem key={d} value={String(idx + 1)}>{d}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Salle</Label><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
            <div className="space-y-2"><Label>Début</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            <div className="space-y-2"><Label>Fin</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saveSession.isPending}>Ajouter</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}
