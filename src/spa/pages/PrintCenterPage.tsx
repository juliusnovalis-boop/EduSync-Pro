import { Printer, FileText, FileSpreadsheet, CreditCard, QrCode as QrIcon, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader, SectionCard } from "../components/ui-kit";
import { Button } from "../components/ui";

const PRINT_TARGETS = [
  { title: "Bulletins", desc: "Imprimer les bulletins de notes par classe", icon: FileText, url: "/bulletins", tone: "bg-primary/10 text-primary" },
  { title: "Rapports", desc: "Rapports statistiques (moyennes, finances, présence)", icon: BarChart3, url: "/reports", tone: "bg-info/10 text-info" },
  { title: "Cartes scolaires", desc: "Générer et imprimer les cartes élève (lot PDF)", icon: CreditCard, url: "/student-cards", tone: "bg-success/10 text-success" },
  { title: "Documents", desc: "Certificats, attestations, reçus (PDF)", icon: FileText, url: "/document-studio", tone: "bg-warning/15 text-warning-foreground" },
  { title: "QR Codes", desc: "Imprimer des QR Codes (élèves, classes, Wi-Fi)", icon: QrIcon, url: "/qr-center", tone: "bg-primary/10 text-primary" },
  { title: "Listes de classe", desc: "Liste des élèves par classe", icon: FileSpreadsheet, url: "/students", tone: "bg-info/10 text-info" },
];

export default function PrintCenterPage() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Centre d'impression" subtitle="Accédez à tous les documents imprimables et lancez l'impression." />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PRINT_TARGETS.map((t) => (
          <Link key={t.title} to={t.url}>
            <SectionCard title={t.title} description={t.desc} className="transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
              <div className="flex items-center gap-3">
                <span className={`flex size-12 items-center justify-center rounded-xl ${t.tone}`}><t.icon className="size-6" /></span>
                <Button variant="outline" size="sm"><Printer className="mr-1 size-3.5" /> Ouvrir</Button>
              </div>
            </SectionCard>
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <SectionCard title="Conseils d'impression" icon={Printer}>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Utilisez le bouton <strong>« Imprimer »</strong> présent sur chaque page de document pour lancer l'impression.</li>
            <li>• Les <strong>cartes scolaires</strong> et <strong>bulletins</strong> sont optimisés pour l'A4 portrait.</li>
            <li>• Pour un lot entier (ex : 45 bulletins), utilisez la génération PDF puis imprimez le fichier complet.</li>
            <li>• Les QR Codes sont en haute résolution (400px) pour une lecture fiable.</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
