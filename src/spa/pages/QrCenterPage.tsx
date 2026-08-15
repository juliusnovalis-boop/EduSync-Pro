import { useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode as QrIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard } from "../components/ui-kit";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input } from "../components/ui";
import { useRows, useSaveRow } from "../lib/data";
import { fullName, type SchoolClass, type Student } from "../lib/types";

type QrType = "student" | "class" | "bulletin" | "document" | "wifi";

const QR_TYPES: { value: QrType; label: string }[] = [
  { value: "student", label: "Élève" },
  { value: "class", label: "Classe" },
  { value: "bulletin", label: "Bulletin" },
  { value: "document", label: "Document" },
  { value: "wifi", label: "Wi-Fi" },
];

export default function QrCenterPage() {
  const students = useRows<Student>("students", { order: "last_name", ascending: true });
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const saveQr = useSaveRow("qr_codes", "QR Code");

  const [type, setType] = useState<QrType>("student");
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [generated, setGenerated] = useState<{ url: string; title: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      let content = "";
      let title = "";
      if (type === "student") {
        const s = (students.data ?? []).find((x) => x.id === studentId);
        if (!s) { toast.error("Sélectionnez un élève"); return; }
        const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        content = `${window.location.origin}/api/verify-qr/${token}`;
        title = `Élève — ${fullName(s)}`;
        const url = await QRCode.toDataURL(content, { width: 400, margin: 2, color: { dark: "#13131c", light: "#ffffff" } });
        setGenerated({ url, title });
        saveQr.mutate({ values: { type, token, title, payload: JSON.stringify({ type: "student", id: s.id, name: fullName(s), matricule: s.matricule }), linked_id: s.id } });
        toast.success("QR Code généré");
        return;
      } else if (type === "class") {
        const c = (classes.data ?? []).find((x) => x.id === classId);
        if (!c) { toast.error("Sélectionnez une classe"); return; }
        const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        content = `${window.location.origin}/api/verify-qr/${token}`;
        title = `Classe — ${c.name}`;
        const url = await QRCode.toDataURL(content, { width: 400, margin: 2, color: { dark: "#13131c", light: "#ffffff" } });
        setGenerated({ url, title });
        saveQr.mutate({ values: { type, token, title, payload: JSON.stringify({ type: "class", id: c.id, name: c.name }), linked_id: c.id } });
        toast.success("QR Code généré");
        return;
      } else if (type === "wifi") {
        if (!wifiSsid) { toast.error("Entrez le nom du réseau Wi-Fi"); return; }
        content = `WIFI:T:WPA;S:${wifiSsid};P:${wifiPass};;`;
        title = `Wi-Fi — ${wifiSsid}`;
        const url = await QRCode.toDataURL(content, { width: 400, margin: 2, color: { dark: "#13131c", light: "#ffffff" } });
        setGenerated({ url, title });
        saveQr.mutate({ values: { type, token: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, title, payload: "Wi-Fi", linked_id: null } });
        toast.success("QR Code généré");
        return;
      } else {
        const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        content = `${window.location.origin}/api/verify-qr/${token}`;
        title = `${type} — ${new Date().toLocaleDateString("fr-FR")}`;
        const url = await QRCode.toDataURL(content, { width: 400, margin: 2, color: { dark: "#13131c", light: "#ffffff" } });
        setGenerated({ url, title });
        saveQr.mutate({ values: { type, token, title, payload: JSON.stringify({ type, date: new Date().toISOString() }), linked_id: null } });
        toast.success("QR Code généré");
        return;
      }
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  function download() {
    if (!generated) return;
    const link = document.createElement("a");
    link.href = generated.url;
    link.download = `qr-${generated.title.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.click();
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="QR Center" subtitle="Générez des QR Codes sécurisés pour élèves, classes, bulletins et plus." />
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Créer un QR Code" description="Choisissez le type et l'entité" icon={QrIcon}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de QR Code</Label>
              <Select value={type} onValueChange={(v) => setType(v as QrType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{QR_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {type === "student" && (
              <div className="space-y-2"><Label>Élève</Label>
                <Select value={studentId} onValueChange={setStudentId}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{(students.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{fullName(s)}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
            {type === "class" && (
              <div className="space-y-2"><Label>Classe</Label>
                <Select value={classId} onValueChange={setClassId}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
            {type === "wifi" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label>SSID (réseau)</Label><Input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="MonReseau" /></div>
                <div className="space-y-2"><Label>Mot de passe</Label><Input value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="••••••" /></div>
              </div>
            )}
            <Button onClick={generate} disabled={generating} className="w-full">
              {generating ? <Sparkles className="mr-2 size-4 animate-spin" /> : <QrIcon className="mr-2 size-4" />} Générer le QR Code
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Aperçu" description="QR Code généré" icon={QrIcon}>
          {generated ? (
            <div className="flex flex-col items-center gap-4">
              <img src={generated.url} alt="QR Code" className="rounded-xl border border-border p-4" width={300} height={300} />
              <div className="text-center">
                <p className="font-bold">{generated.title}</p>
                <Pill tone="success">✓ Authentique</Pill>
              </div>
              <Button onClick={download} variant="outline"><Download className="mr-2 size-4" /> Télécharger PNG</Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <QrIcon className="size-12 opacity-40" />
              <p className="mt-3 text-sm">Configurez et générez un QR Code.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
