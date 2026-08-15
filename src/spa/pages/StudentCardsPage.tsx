import { useState } from "react";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { IdCard, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard } from "../components/ui-kit";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui";
import { useRows } from "../lib/data";
import { fullName, type SchoolClass, type Student } from "../lib/types";

export default function StudentCardsPage() {
  const students = useRows<Student>("students", { order: "last_name", ascending: true });
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const [classId, setClassId] = useState("");
  const [generating, setGenerating] = useState(false);

  const activeClass = classId || (classes.data ?? [])[0]?.id || "";
  const classStudents = (students.data ?? []).filter((s) => s.class_id === activeClass);

  async function generateBatch() {
    if (!classStudents.length) return toast.error("Aucun élève dans cette classe");
    setGenerating(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      let x = 10, y = 10;
      let count = 0;

      for (const s of classStudents) {
        const name = fullName(s);
        const cls = (classes.data ?? []).find((c) => c.id === s.class_id);
        const qrContent = JSON.stringify({ type: "student", id: s.id, name, matricule: s.matricule });
        const qrDataUrl = await QRCode.toDataURL(qrContent, { width: 200, margin: 1 });

        const cardW = 85, cardH = 54;
        if (x + cardW > pageW - 10) { x = 10; y += cardH + 5; }
        if (y + cardH > 287) { pdf.addPage(); x = 10; y = 10; }

        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(x, y, cardW, cardH, 3, 3, "F");
        pdf.setDrawColor(117, 80, 236);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(x, y, cardW, cardH, 3, 3, "S");

        pdf.setFillColor(117, 80, 236);
        pdf.roundedRect(x, y, cardW, 10, 3, 3, "F");
        pdf.rect(x, y + 7, cardW, 3, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text("EDUSYNC PRO — CARTE SCOLAIRE", x + cardW / 2, y + 6.5, { align: "center" });

        pdf.setTextColor(19, 19, 28);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        const nameLines = pdf.splitTextToSize(name, 45) as string[];
        pdf.text(nameLines, x + 4, y + 18);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.text(`Classe: ${cls?.name ?? "—"}`, x + 4, y + 26);
        pdf.text(`Matricule: ${s.matricule ?? "—"}`, x + 4, y + 31);
        pdf.text("Année: 2025-2026", x + 4, y + 36);
        pdf.text(`Genre: ${s.gender === "F" ? "Féminin" : "Masculin"}`, x + 4, y + 41);

        pdf.addImage(qrDataUrl, "PNG", x + cardW - 28, y + 16, 22, 22);

        pdf.setFontSize(5);
        pdf.setTextColor(150, 150, 150);
        pdf.text("Lycée National Léon Mba — Libreville", x + cardW / 2, y + cardH - 3, { align: "center" });

        x += cardW + 5;
        count++;
      }

      pdf.save(`cartes-scolaires-${(classes.data ?? []).find((c) => c.id === activeClass)?.name ?? "classe"}.pdf`);
      toast.success(`${count} carte(s) générée(s)`, { description: "PDF téléchargé" });
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="Cartes scolaires" subtitle="Générez les cartes d'identité scolaires avec QR Code pour toute une classe."
        action={<Button onClick={generateBatch} disabled={generating}>{generating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />} Générer le lot PDF</Button>} />
      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <StatCard label="Élèves dans la classe" value={classStudents.length} icon={IdCard} tone="violet" />
        <StatCard label="Classes disponibles" value={classes.data?.length ?? 0} icon={IdCard} tone="blue" />
        <StatCard label="Format" value="85×54mm" icon={IdCard} tone="green" />
      </div>
      <div className="mb-6">
        <Label className="mb-2 block">Classe</Label>
        <Select value={activeClass} onValueChange={setClassId}><SelectTrigger className="w-64"><SelectValue placeholder="Choisir" /></SelectTrigger>
          <SelectContent>{(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <SectionCard title="Aperçu des cartes" description={`${classStudents.length} élève(s)`} icon={IdCard}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classStudents.slice(0, 9).map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-border shadow-sm">
              <div className="bg-primary px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-primary-foreground">EduSync Pro — Carte</div>
              <div className="flex items-center gap-3 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{s.first_name[0]}{s.last_name[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{fullName(s)}</p>
                  <p className="text-xs text-muted-foreground">{s.matricule ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{(classes.data ?? []).find((c) => c.id === s.class_id)?.name}</p>
                </div>
                <div className="flex size-12 shrink-0 items-center justify-center rounded bg-muted"><IdCard className="size-5 text-muted-foreground" /></div>
              </div>
            </div>
          ))}
        </div>
        {classStudents.length > 9 && <p className="mt-4 text-center text-sm text-muted-foreground">+ {classStudents.length - 9} autre(s) — générées dans le PDF</p>}
      </SectionCard>
    </div>
  );
}
