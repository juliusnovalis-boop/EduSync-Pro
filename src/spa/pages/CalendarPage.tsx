import { useState } from "react";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard } from "../components/ui-kit";
import { Button, Dialog, DialogCloseButton, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "../components/ui";
import { useDeleteRow, useRows, useSaveRow } from "../lib/data";
import { EVENT_TYPES, type CalendarEvent } from "../lib/types";

const TONE: Record<string, "danger" | "warning" | "info" | "primary" | "success" | "muted"> = {
  examen: "danger",
  ferie: "warning",
  reunion: "info",
  conges: "primary",
  sortie: "success",
  event: "muted",
};

function formatRange(start: string, end: string | null) {
  if (!start) return "—";
  const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  return end && end !== start ? `${fmt(start)} → ${fmt(end)}` : fmt(start);
}

export default function CalendarPage() {
  const events = useRows<CalendarEvent>("events", { order: "start_date", ascending: true });
  const save = useSaveRow("events", "Événement");
  const remove = useDeleteRow("events", "Événement");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "event", start_date: new Date().toISOString().slice(0, 10), end_date: "", description: "" });

  function submit() {
    if (!form.title || !form.start_date) return toast.error("Titre et date de début requis");
    save.mutate(
      { values: { ...form, end_date: form.end_date || null } },
      { onSuccess: () => { setOpen(false); setForm({ title: "", type: "event", start_date: new Date().toISOString().slice(0, 10), end_date: "", description: "" }); } },
    );
  }

  const rows = events.data ?? [];
  const upcoming = rows.filter((e) => new Date(e.start_date) >= new Date(new Date().toDateString()));

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Calendrier académique"
        subtitle="Examens, réunions, congés et événements de l'établissement."
        action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 size-4" /> Nouvel événement</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SectionCard title="À venir" className="p-5"><p className="text-3xl font-extrabold">{upcoming.length}</p><p className="text-xs text-muted-foreground">événement(s) planifié(s)</p></SectionCard>
        <SectionCard title="Total" className="p-5"><p className="text-3xl font-extrabold">{rows.length}</p><p className="text-xs text-muted-foreground">événement(s) au calendrier</p></SectionCard>
        <SectionCard title="Examens" className="p-5"><p className="text-3xl font-extrabold">{rows.filter((e) => e.type === "examen").length}</p><p className="text-xs text-muted-foreground">période(s) d'examen</p></SectionCard>
      </div>

      <SectionCard title="Agenda" description="Chronologie des événements" icon={CalendarRange}>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun événement.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-6">
            {rows.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[31px] top-1 flex size-4 items-center justify-center rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{e.title}</h3>
                  <Pill tone={TONE[e.type] ?? "muted"}>{EVENT_TYPES[e.type] ?? e.type}</Pill>
                  <span className="text-xs text-muted-foreground">{formatRange(e.start_date, e.end_date)}</span>
                  <button className="ml-auto text-destructive hover:opacity-70" onClick={() => remove.mutate(e.id)}><Trash2 className="size-4" /></button>
                </div>
                {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <div>
          <DialogCloseButton onClick={() => setOpen(false)} />
          <DialogHeader><DialogTitle>Nouvel événement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="ev-title">Titre</Label><Input id="ev-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EVENT_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Début</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fin</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="ev-desc">Description</Label><Textarea id="ev-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter className="mt-4"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={submit} disabled={save.isPending}>Ajouter</Button></DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}
