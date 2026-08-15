import { useState } from "react";
import { Megaphone, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard } from "../components/ui-kit";
import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "../components/ui";
import { useDeleteRow, useRows, useSaveRow } from "../lib/data";
import { ANNOUNCEMENT_AUDIENCES, fullName, type Announcement, type Message, type Student, type Teacher } from "../lib/types";

export default function CommunicationPage() {
  const announcements = useRows<Announcement>("announcements", { order: "date" });
  const messages = useRows<Message>("messages", { order: "date" });
  const students = useRows<Student>("students", { order: "last_name", ascending: true });
  const teachers = useRows<Teacher>("teachers", { order: "last_name", ascending: true });
  const studentById = new Map((students.data ?? []).map((s) => [s.id, fullName(s)]));
  const teacherById = new Map((teachers.data ?? []).map((t) => [t.id, fullName(t)]));

  const [annOpen, setAnnOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [ann, setAnn] = useState({ title: "", body: "", audience: "all", priority: "normale" });
  const [msg, setMsg] = useState({ recipient_id: "", recipient_type: "student", subject: "", body: "" });

  const saveAnn = useSaveRow("announcements", "Annonce");
  const saveMsg = useSaveRow("messages", "Message");
  const delAnn = useDeleteRow("announcements", "Annonce");
  const delMsg = useDeleteRow("messages", "Message");

  function submitAnn() {
    if (!ann.title || !ann.body) return toast.error("Titre et contenu requis");
    saveAnn.mutate({ values: { ...ann, author_name: "Direction", date: new Date().toISOString().slice(0, 10) } }, { onSuccess: () => { setAnnOpen(false); setAnn({ title: "", body: "", audience: "all", priority: "normale" }); } });
  }
  function submitMsg() {
    if (!msg.recipient_id || !msg.subject || !msg.body) return toast.error("Destinataire, objet et contenu requis");
    saveMsg.mutate({ values: { ...msg, sender_name: "Direction", status: "unread", date: new Date().toISOString().slice(0, 10) } }, { onSuccess: () => { setMsgOpen(false); setMsg({ recipient_id: "", recipient_type: "student", subject: "", body: "" }); } });
  }
  function recipientLabel(m: Message) {
    if (m.recipient_type === "student") return studentById.get(m.recipient_id) ?? "—";
    if (m.recipient_type === "teacher") return teacherById.get(m.recipient_id) ?? "—";
    return m.recipient_id;
  }

  const recipientOptions =
    msg.recipient_type === "student"
      ? (students.data ?? []).map((s) => ({ value: s.id, label: fullName(s) }))
      : (teachers.data ?? []).map((t) => ({ value: t.id, label: fullName(t) }));

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader title="Communication" subtitle="Annonces de l'établissement et messagerie interne." />

      <Tabs defaultValue="announcements">
        <TabsList>
          <TabsTrigger value="announcements"><Megaphone className="mr-1 size-4" /> Annonces</TabsTrigger>
          <TabsTrigger value="messages"><MessageSquare className="mr-1 size-4" /> Messagerie</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements">
          <SectionCard title="Annonces publiées" description={`${announcements.data?.length ?? 0} annonce(s)`} icon={Megaphone} className="mt-5">
            <div className="mb-4"><Button onClick={() => setAnnOpen(true)}><Megaphone className="mr-2 size-4" /> Nouvelle annonce</Button></div>
            <ul className="space-y-3">
              {(announcements.data ?? []).length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Aucune annonce.</li>}
              {(announcements.data ?? []).map((a) => (
                <li key={a.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{a.title}</h3>
                    <Pill tone={a.priority === "haute" ? "danger" : "muted"}>{a.priority === "haute" ? "Prioritaire" : "Normale"}</Pill>
                    <Pill tone="info">{ANNOUNCEMENT_AUDIENCES[a.audience] ?? a.audience}</Pill>
                    <span className="ml-auto text-xs text-muted-foreground">{a.date}</span>
                    <button className="text-xs text-destructive hover:underline" onClick={() => delAnn.mutate(a.id)}>Supprimer</button>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">— {a.author_name ?? "Direction"}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="messages">
          <SectionCard title="Boîte d'envoi" description={`${messages.data?.length ?? 0} message(s)`} icon={MessageSquare} className="mt-5">
            <div className="mb-4"><Button onClick={() => setMsgOpen(true)}><Send className="mr-2 size-4" /> Nouveau message</Button></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Objet</TableHead>
                    <TableHead>Expéditeur</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(messages.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucun message.</TableCell></TableRow>
                  )}
                  {(messages.data ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold">{recipientLabel(m)}</TableCell>
                      <TableCell>{m.subject}</TableCell>
                      <TableCell className="text-muted-foreground">{m.sender_name}</TableCell>
                      <TableCell className="text-muted-foreground">{m.date}</TableCell>
                      <TableCell><Pill tone={m.status === "unread" ? "warning" : "muted"}>{m.status === "unread" ? "Non lu" : "Lu"}</Pill></TableCell>
                      <TableCell className="text-right"><button className="text-xs text-destructive hover:underline" onClick={() => delMsg.mutate(m.id)}>Supprimer</button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={annOpen} onOpenChange={setAnnOpen}>
        <div>
          <DialogCloseButton onClick={() => setAnnOpen(false)} />
          <DialogHeader><DialogTitle>Nouvelle annonce</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="ann-title">Titre</Label><Input id="ann-title" value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Public cible</Label>
                <Select value={ann.audience} onValueChange={(v) => setAnn({ ...ann, audience: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ANNOUNCEMENT_AUDIENCES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Priorité</Label>
                <Select value={ann.priority} onValueChange={(v) => setAnn({ ...ann, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normale">Normale</SelectItem><SelectItem value="haute">Haute</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="space-y-2"><Label htmlFor="ann-body">Contenu</Label><Textarea id="ann-body" value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} rows={4} /></div>
          </div>
          <DialogFooter className="mt-4"><Button variant="outline" onClick={() => setAnnOpen(false)}>Annuler</Button><Button onClick={submitAnn} disabled={saveAnn.isPending}>Publier</Button></DialogFooter>
        </div>
      </Dialog>

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <div>
          <DialogCloseButton onClick={() => setMsgOpen(false)} />
          <DialogHeader><DialogTitle>Nouveau message</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Type de destinataire</Label>
                <Select value={msg.recipient_type} onValueChange={(v) => setMsg({ ...msg, recipient_type: v, recipient_id: "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">Élève</SelectItem><SelectItem value="teacher">Enseignant</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Destinataire</Label>
                <Select value={msg.recipient_id} onValueChange={(v) => setMsg({ ...msg, recipient_id: v })}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{recipientOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="space-y-2"><Label htmlFor="msg-subject">Objet</Label><Input id="msg-subject" value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="msg-body">Message</Label><Textarea id="msg-body" value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} rows={4} /></div>
          </div>
          <DialogFooter className="mt-4"><Button variant="outline" onClick={() => setMsgOpen(false)}>Annuler</Button><Button onClick={submitMsg} disabled={saveMsg.isPending}><Send className="mr-2 size-4" /> Envoyer</Button></DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}
