import { useState, useEffect } from "react";
import { Sparkles, Loader2, Cpu, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard } from "../components/ui-kit";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "../components/ui";
import { VoiceInput } from "../components/VoiceInput";
import { TERMS, TERM_KEYS } from "../lib/types";

function renderLine(line: string, key: number) {
  const bold = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
    );
  if (line.startsWith("## ")) return <h2 key={key} className="mt-6 text-xl font-extrabold tracking-tight first:mt-0">{bold(line.slice(3))}</h2>;
  if (line.startsWith("### ")) return <h3 key={key} className="mt-4 text-base font-bold">{bold(line.slice(4))}</h3>;
  if (line.startsWith("> ")) return <blockquote key={key} className="my-2 border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">{bold(line.slice(2))}</blockquote>;
  if (line.startsWith("- ")) return <li key={key} className="ml-5 list-disc text-sm leading-relaxed">{bold(line.slice(2))}</li>;
  if (/^\d+\./.test(line)) return <li key={key} className="ml-5 list-decimal text-sm leading-relaxed">{bold(line)}</li>;
  if (line.trim() === "") return <div key={key} className="h-2" />;
  return <p key={key} className="text-sm leading-relaxed">{bold(line)}</p>;
}

type AnalysisResponse = {
  report: string;
  term: string;
  termLabel: string;
  source: "gemini" | "huggingface" | "local";
  aiEnabled: boolean;
  label: string;
};

export default function IaAnalysisPage() {
  const [term, setTerm] = useState("T1");
  const [focus, setFocus] = useState("");
  const [report, setReport] = useState("");
  const [source, setSource] = useState<"gemini" | "huggingface" | "local">("local");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [label, setLabel] = useState("IA");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d: { aiEnabled: boolean; label: string }) => {
        setAiEnabled(d.aiEnabled);
        setLabel(d.label ?? "IA");
      })
      .catch(() => {});
  }, []);

  async function generate() {
    setLoading(true);
    setReport("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, focus }),
      });
      if (!res.ok) throw new Error("Échec de l'analyse");
      const data = (await res.json()) as AnalysisResponse;
      setReport(data.report);
      setSource(data.source);
      setAiEnabled(data.aiEnabled);
      setLabel(data.label ?? "IA");
      if (data.source === "local" && data.aiEnabled) {
        toast.success("Analyse générée", { description: "Fallback local (IA indisponible)" });
      } else if (data.source === "local") {
        toast.success("Analyse générée", { description: "Moteur local" });
      } else {
        toast.success("Analyse IA générée", { description: `Via ${data.label}` });
      }
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="Analyse IA" subtitle="Synthèse pédagogique automatique — propulsée par Google Gemini avec fallback local." />
      <div className="mb-6 grid gap-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">Période</label>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute l'année</SelectItem>
              {TERM_KEYS.map((t) => <SelectItem key={t} value={t}>{TERMS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Axe d'analyse (optionnel)</label>
          <div className="flex gap-2">
            <Textarea placeholder="Ex : comment améliorer les résultats en sciences ?" value={focus} onChange={(e) => setFocus(e.target.value)} className="min-h-[44px]" />
            <VoiceInput onTranscribe={(t) => setFocus((prev) => (prev ? `${prev} ${t}` : t))} />
          </div>
        </div>
        <Button onClick={generate} disabled={loading} className="h-9">
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />} Générer
        </Button>
      </div>

      <SectionCard
        title="Rapport"
        description="Synthèse calculée à partir des notes, présences et paiements."
        icon={Sparkles}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {loading ? (
            <Pill tone="info"><Loader2 className="mr-1 size-3 animate-spin" /> {aiEnabled ? `${label} en cours…` : "Analyse locale…"}</Pill>
          ) : report ? (
            source === "local" && aiEnabled ? (
              <Pill tone="warning"><Cpu className="mr-1 size-3" /> Fallback local (IA indisponible)</Pill>
            ) : source === "local" ? (
              <Pill tone="muted"><Cpu className="mr-1 size-3" /> Moteur local</Pill>
            ) : (
              <Pill tone="success"><Zap className="mr-1 size-3" /> {label} actif</Pill>
            )
          ) : null}
          {!loading && !report && aiEnabled && (
            <Pill tone="success"><Zap className="mr-1 size-3" /> {label} configuré</Pill>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${70 + Math.random() * 30}%` }} />
            ))}
          </div>
        ) : report ? (
          <div className="prose-edusync">{report.split("\n").map(renderLine)}</div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Sparkles className="size-10 text-primary" />
            <p className="mt-3 text-sm">Lancez une analyse pour obtenir une synthèse détaillée de la période.</p>
            <p className="mt-1 text-xs">L'IA analyse vos données réelles : élèves, notes, présences et finances.</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
