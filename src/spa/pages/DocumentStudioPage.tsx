import { useState } from "react";
import jsPDF from "jspdf";
import { FileStack, Download, FileText, Receipt, Award } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard } from "../components/ui-kit";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Textarea } from "../components/ui";
import { useRows, useSaveRow } from "../lib/data";
import { fullName, type SchoolClass, type Student } from "../lib/types";

type DocType = "certificat" | "attestation" | "recu";

const DOC_TYPES: { value: DocType; label: string; icon: typeof FileText; desc: string }[] = [
  { value: "certificat", label: "Certificat de scolarité", icon: Award, desc: "Atteste qu'un élève est inscrit" },
  { value: "attestation", label: "Attestation de réussite", icon: FileText, desc: "Atteste la réussite d'une période" },
  { value: "recu", label: "Reçu de paiement", icon: Receipt, desc: "Confirme un paiement reçu" },
];

export default function DocumentStudioPage() {
  const students = useRows<Student>("students", { order: "last_name", ascending: true });
  const classes = useRows<SchoolClass>("classes", { order: "name", ascending: true });
  const saveDoc = useSaveRow("digital_documents", "Document");

  const [docType, setDocType] = useState<DocType>("certificat");
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [customText, setCustomText] = useState("");

  function generatePdf() {
    const student = (students.data ?? []).find((s) => s.id === studentId);
    if (!student) return toast.error("Sélectionnez un élève");
    const cls = (classes.data ?? []).find((c) => c.id === student.class_id);
    const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const name = fullName(student);

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 30;

    doc.setFillColor(117, 80, 236);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("EDUSYNC PRO", pageW / 2, 15, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Lycée National Léon Mba — Libreville, Gabon", pageW / 2, 22, { align: "center" });

    y = 50;
    doc.setTextColor(19, 19, 28);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const title = DOC_TYPES.find((d) => d.value === docType)?.label ?? "Document";
    doc.text(title.toUpperCase(), pageW / 2, y, { align: "center" });

    doc.setDrawColor(117, 80, 236);
    doc.setLineWidth(0.8);
    doc.line(60, y + 4, pageW - 60, y + 4);

    y += 20;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    if (docType === "certificat") {
      doc.text("Je soussigné(e), Directeur(trice) du Lycée National Léon Mba, certifie que :", 25, y);
      y += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(name, pageW / 2, y, { align: "center" });
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`Né(e) le ${student.birth_date ?? "—"} — Matricule : ${student.matricule ?? "—"}`, pageW / 2, y, { align: "center" });
      y += 12;
      doc.text(`est régulièrement inscrit(e) en classe de ${cls?.name ?? "—"} pour l'année scolaire 2025-2026.`, 25, y);
      y += 10;
      doc.text("En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.", 25, y);
    } else if (docType === "attestation") {
      doc.text("Il est attesté que l'élève :", 25, y);
      y += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(name, pageW / 2, y, { align: "center" });
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`a suivi avec succès le programme de la classe de ${cls?.name ?? "—"} durant l'année 2025-2026.`, 25, y);
      y += 10;
      if (customText) { const lines = doc.splitTextToSize(customText, pageW - 50) as string[]; doc.text(lines, 25, y); y += lines.length * 7; }
      doc.text("Cette attestation est délivrée à la demande de l'intéressé(e).", 25, y);
    } else if (docType === "recu") {
      doc.text(`Reçu de la somme de : ${Number(amount || 0).toLocaleString("fr-FR")} FCFA`, 25, y);
      y += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(name, pageW / 2, y, { align: "center" });
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`Classe : ${cls?.name ?? "—"} — Matricule : ${student.matricule ?? "—"}`, pageW / 2, y, { align: "center" });
      y += 12;
      doc.text("Mode de règlement : Espèces / Mobile Money", 25, y);
    }

    y = 240;
    doc.setDrawColor(180, 180, 180);
    doc.line(pageW - 70, y, pageW - 25, y);
    doc.setFontSize(10);
    doc.text("Le Directeur", pageW - 47, y + 6, { align: "center" });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Établi le ${today} — EduSync Pro · Document généré électroniquement`, pageW / 2, 285, { align: "center" });

    const filename = `${docType}-${name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    doc.save(filename);

    saveDoc.mutate({ values: { title: `${title} — ${name}`, type: docType, student_id: studentId, class_id: student.class_id } });
    toast.success("Document généré", { description: filename });
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader title="Document Studio" subtitle="Générez des documents officiels (PDF) : certificats, attestations, reçus." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <SectionCard title="Créer un document" icon={FileStack}>
          <div className="space-y-5">
            <div>
              <Label className="mb-3 block">Type de document</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {DOC_TYPES.map((d) => (
                  <button key={d.value} type="button" onClick={() => setDocType(d.value)}
                    className={`rounded-xl border p-4 text-left transition ${docType === d.value ? "border-primary bg-accent/50 ring-1 ring-ring" : "border-border hover:bg-accent/30"}`}>
                    <d.icon className="size-5 text-primary" />
                    <span className="mt-2 block text-sm font-bold">{d.label}</span>
                    <span className="text-xs text-muted-foreground">{d.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>Élève concerné</Label>
              <Select value={studentId} onValueChange={setStudentId}><SelectTrigger><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
                <SelectContent>{(students.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{fullName(s)}</SelectItem>)}</SelectContent></Select>
            </div>
            {docType === "recu" && <div className="space-y-2"><Label>Montant (FCFA)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="150000" /></div>}
            {docType === "attestation" && <div className="space-y-2"><Label>Texte complémentaire (optionnel)</Label><Textarea value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Mention spéciale, observations..." /></div>}
            <Button onClick={generatePdf} className="w-full"><Download className="mr-2 size-4" /> Générer le PDF</Button>
          </div>
        </SectionCard>
        <SectionCard title="Aperçu" icon={FileText}>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
            <div className="rounded-xl border-2 border-dashed border-border p-8">
              <FileText className="size-12 opacity-40" />
              <p className="mt-3 text-sm font-medium">{DOC_TYPES.find((d) => d.value === docType)?.label}</p>
              <p className="text-xs">Le PDF se générera et se téléchargera automatiquement</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
