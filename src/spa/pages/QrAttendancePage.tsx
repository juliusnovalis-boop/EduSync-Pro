import { useState } from "react";
import QRCode from "qrcode";
import { ScanLine, Plus, Clock, Users, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard, StatCard } from "../components/ui-kit";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui";
import { useRows, useSaveRow } from "../lib/data";
import { fullName, type AttendanceSession, type SchoolClass, type Student } from "../lib/types";

export default function QrAttendancePage() {
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const students = useRows<Student>("students", { order: "last_name", ascending: true });
  const sessions = useRows<AttendanceSession>("attendance_sessions", { order: "created_at" });
  const records = useRows<{ id: string; session_id: string; student_id: string; scanned_at: string; status: string }>("attendance_qr_records", { order: "created_at" });
  const saveSession = useSaveRow("attendance_sessions", "Séance");

  const [classId, setClassId] = useState("");
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const activeClass = classId || (classes.data ?? [])[0]?.id || "";
  const sessionRecords = (records.data ?? []).filter((r) => r.session_id === activeSession?.id);
  const presentIds = new Set(sessionRecords.map((r) => r.student_id));
  const classStudentIds = new Set((students.data ?? []).filter((s) => s.class_id === activeSession?.class_id).map((s) => s.id));

  async function createSession() {
    if (!activeClass) return toast.error("Choisissez une classe");
    setCreating(true);
    try {
      const token = `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const today = new Date().toISOString().slice(0, 10);
      const url = await QRCode.toDataURL(JSON.stringify({ type: "attendance", token, classId: activeClass, date: today }), { width: 350, margin: 2, color: { dark: "#13131c", light: "#ffffff" } });
      setQrUrl(url);
      const sess = { class_id: activeClass, teacher_name: "Direction", date: today, qr_token: token, status: "ouvert" };
      saveSession.mutate({ values: sess }, {
        onSuccess: () => {
          setTimeout(() => {
            const latest = (sessions.data ?? [])[0];
            if (latest) setActiveSession(latest);
          }, 500);
        },
      });
      toast.success("Séance créée — affichez le QR aux élèves");
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  }

  const presentCount = [...presentIds].filter((id) => classStudentIds.has(id)).length;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Présence QR" subtitle="Créez une séance, affichez le QR — les élèves scannent pour signaler leur présence." />
      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <StatCard label="Présents" value={`${presentCount}/${classStudentIds.size}`} icon={CheckCircle2} tone="green" />
        <StatCard label="Taux présence" value={classStudentIds.size ? `${Math.round((presentCount / classStudentIds.size) * 100)}%` : "—"} icon={Users} tone="violet" />
        <StatCard label="Séances totales" value={sessions.data?.length ?? 0} icon={Clock} tone="blue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Démarrer une séance" icon={Plus}>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Classe</Label>
              <Select value={activeClass} onValueChange={setClassId}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button onClick={createSession} disabled={creating} className="w-full">
              {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />} Créer la séance & générer le QR
            </Button>
            {qrUrl && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border p-4">
                <img src={qrUrl} alt="QR présence" className="rounded-lg" width={250} height={250} />
                <p className="text-center text-sm font-semibold">Scannez ce QR Code pour pointer votre présence</p>
                <Pill tone="success">Séance ouverte</Pill>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Présences en temps réel" description={activeSession ? `${presentCount} présent(s)` : "Aucune séance active"} icon={ScanLine}>
          {!activeSession ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Créez une séance pour voir les présences.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Élève</TableHead><TableHead className="text-right">Statut</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(students.data ?? []).filter((s) => s.class_id === activeSession.class_id).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">{fullName(s)}</TableCell>
                      <TableCell className="text-right">{presentIds.has(s.id) ? <Pill tone="success">Présent</Pill> : <Pill tone="muted">En attente</Pill>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
