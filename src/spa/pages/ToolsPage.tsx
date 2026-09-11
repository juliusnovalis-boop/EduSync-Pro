import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Search, FileStack, Minimize2, Image as ImageIcon, FileText, ScanLine,
  RefreshCw, QrCode, Table, FileSpreadsheet, FileJson, CheckCircle,
  Languages, ClipboardList, GraduationCap, Wrench, Clock, Star, Upload,
  Download, Loader2, X, Sparkles, AudioLines, Crop, RotateCw, FlipHorizontal,
  Palette, Square, Type, BookOpen, HelpCircle, Smile, Calendar, Edit,
  Split, Eraser, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "../components/ui-kit";
import { TOOL_CATEGORIES, TOOLS, type ToolDefinition, type ToolCategory } from "../lib/tools-registry";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

const ICONS: Record<string, LucideIcon> = {
  FileStack, Minimize2, Image: ImageIcon, FileText, ScanLine, RefreshCw,
  QrCode, Table, FileSpreadsheet, FileJson, CheckCircle, Languages,
  ClipboardList, GraduationCap, Sparkles, AudioLines, Crop, RotateCw,
  FlipHorizontal, Palette, Square, Type, BookOpen, HelpCircle, Smile,
  Calendar, Edit, Split, Eraser,
};

const FAVORITES_KEY = "edusync_tools_favorites";
const RECENT_KEY = "edusync_tools_recent";

function loadSet(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]") as string[]; } catch { return []; } }
function saveSet(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

function getToolTextParam(tool: ToolDefinition): { label: string; placeholder: string; hint: string } {
  switch (tool.id) {
    case "add-border-image":
      return { label: "Largeur bordure (px)", placeholder: "Ex: 20", hint: "Largeur de la bordure en pixels (5-200)" };
    case "watermark-image":
      return { label: "Texte du filigrane", placeholder: "Ex: EduSync", hint: "Texte à superposer sur l''image" };
    case "split-csv":
      return { label: "Taille du lot (lignes)", placeholder: "Ex: 100", hint: "Nombre de lignes par fichier généré" };
    case "ai-summarize":
      return { label: "Texte à résumer", placeholder: "Collez votre texte ici...", hint: "Texte à analyser par IA" };
    case "ai-correct":
      return { label: "Texte à corriger", placeholder: "Collez votre texte ici...", hint: "Texte à corriger" };
    case "ai-rephrase":
      return { label: "Texte à reformuler", placeholder: "Collez votre texte ici...", hint: "Texte à reformuler" };
    case "ai-translate":
      return { label: "Texte à traduire", placeholder: "Collez votre texte ici...", hint: "Texte à traduire en anglais" };
    case "ai-questions":
      return { label: "Texte source", placeholder: "Collez votre texte ici...", hint: "Texte à partir duquel générer des questions" };
    case "ai-exercises":
      return { label: "Texte source", placeholder: "Collez votre texte ici...", hint: "Texte à partir duquel générer des exercices" };
    case "ai-revision":
      return { label: "Texte source", placeholder: "Collez votre texte ici...", hint: "Texte à transformer en fiche de révision" };
    case "ai-explanation":
      return { label: "Concept à expliquer", placeholder: "Collez le concept ici...", hint: "Concept pédagogique à expliquer" };
    case "ai-quiz":
      return { label: "Texte source", placeholder: "Collez votre texte ici...", hint: "Texte à partir duquel générer un quiz" };
    case "ai-pedagogical-sheet":
      return { label: "Texte source", placeholder: "Collez votre texte ici...", hint: "Texte à transformer en fiche pédagogique" };
    case "ai-simplify":
      return { label: "Texte à simplifier", placeholder: "Collez votre texte ici...", hint: "Texte à simplifier pour un public jeune" };
    case "ai-lesson-plan":
      return { label: "Thème du cours", placeholder: "Collez le thème ici...", hint: "Thème pour générer un plan de cours" };
    case "ai-exam":
      return { label: "Programme", placeholder: "Collez le programme ici...", hint: "Programme pour générer un sujet d''évaluation" };
    case "qr-generator":
      return { label: "Texte / URL", placeholder: "Ex: https://example.com", hint: "Texte ou URL à encoder" };
    case "json-to-csv":
    case "json-format":
    case "json-validate":
      return { label: "Contenu JSON", placeholder: "{ \"clé\": \" valeur\" }", hint: "Collez votre JSON ici" };
    case "csv-to-json":
    case "clean-csv":
    case "split-csv":
      return { label: "Contenu CSV", placeholder: "col1,col2\nval1,val2", hint: "Collez votre CSV ici" };
    default:
      return { label: "Texte", placeholder: "Saisissez du texte...", hint: "" };
  }
}

/** Exécution réelle (local) pour les outils sans backend IA. */
async function runTool(tool: ToolDefinition, file: File | null, text: string): Promise<{ url: string; name: string } | string | { valid: boolean; error: string | null; preview: string }> {
  switch (tool.id) {
    case "image-to-pdf": {
      if (!file) throw new Error("Sélectionnez une image");
      const { pdfFromImage } = await import("../lib/image-pdf");
      return pdfFromImage(file);
    }
    case "compress-image": {
      if (!file) throw new Error("Sélectionnez une image");
      const { compressImage } = await import("../lib/image-tools");
      return compressImage(file, 0.6);
    }
    case "resize-image": {
      if (!file) throw new Error("Sélectionnez une image");
      const { resizeImage } = await import("../lib/image-tools");
      return resizeImage(file, 1280);
    }
    case "convert-image": {
      if (!file) throw new Error("Sélectionnez une image");
      const { convertImage } = await import("../lib/image-tools");
      return convertImage(file, "image/png");
    }
    case "qr-generator": {
      if (!text.trim()) throw new Error("Saisissez du texte");
      const { generateQr } = await import("../lib/qr-gen");
      return generateQr(text);
    }
    case "crop-image": {
      if (!file) throw new Error("Sélectionnez une image");
      const { cropImage } = await import("../lib/image-tools-extended");
      return cropImage(file);
    }
    case "rotate-image": {
      if (!file) throw new Error("Sélectionnez une image");
      const { rotateImage } = await import("../lib/image-tools-extended");
      return rotateImage(file, 90);
    }
    case "flip-image": {
      if (!file) throw new Error("Sélectionnez une image");
      const { flipImage } = await import("../lib/image-tools-extended");
      return flipImage(file, "horizontal");
    }
    case "grayscale-image": {
      if (!file) throw new Error("Sélectionnez une image");
      const { grayscaleImage } = await import("../lib/image-tools-extended");
      return grayscaleImage(file);
    }
    case "add-border-image": {
      if (!file) throw new Error("Sélectionnez une image");
      if (!text.trim()) throw new Error("Saisissez la largeur de bordure");
      const { addBorderImage } = await import("../lib/image-tools-extended");
      return addBorderImage(file, text);
    }
    case "watermark-image": {
      if (!file) throw new Error("Sélectionnez une image");
      if (!text.trim()) throw new Error("Saisissez le texte du filigrane");
      const { addWatermarkImage } = await import("../lib/image-tools-extended");
      return addWatermarkImage(file, text);
    }
    case "csv-to-excel": {
      if (!file) throw new Error("Sélectionnez un CSV");
      const { csvToExcelHtml } = await import("../lib/table-tools");
      return csvToExcelHtml(await file.text());
    }
    case "json-to-csv": {
      if (!file) throw new Error("Sélectionnez un JSON");
      const { jsonToCsv } = await import("../lib/table-tools");
      return jsonToCsv(await file.text());
    }
    case "json-format": {
      if (!file) throw new Error("Sélectionnez un fichier JSON");
      const { formatJson } = await import("../lib/table-tools-extended");
      return formatJson(await file.text());
    }
    case "json-validate": {
      if (!file) throw new Error("Sélectionnez un fichier JSON");
      const { validateJson } = await import("../lib/table-tools-extended");
      return validateJson(await file.text());
    }
    case "csv-to-json": {
      if (!file) throw new Error("Sélectionnez un CSV");
      const { csvToJson } = await import("../lib/table-tools-extended");
      return csvToJson(await file.text());
    }
    case "split-csv": {
      if (!file) throw new Error("Sélectionnez un CSV");
      const { splitCsv } = await import("../lib/table-tools-extended");
      const result = await splitCsv(await file.text(), text);
      // Retourne la première part (téléchargeable)
      return result.parts[0];
    }
    case "clean-csv": {
      if (!file) throw new Error("Sélectionnez un CSV");
      const { cleanCsv } = await import("../lib/table-tools-extended");
      return cleanCsv(await file.text());
    }
    case "xml-to-json": {
      if (!file) throw new Error("Sélectionnez un XML");
      const { xmlToJson } = await import("../lib/table-tools");
      return xmlToJson(await file.text());
    }
    case "xml-to-csv": {
      if (!file) throw new Error("Sélectionnez un XML");
      const { xmlToCsv } = await import("../lib/table-tools");
      return xmlToCsv(await file.text());
    }
    case "ai-summarize":
    case "ai-correct":
    case "ai-rephrase":
    case "ai-translate":
    case "ai-questions":
    case "ai-exercises":
    case "ai-revision":
    case "ai-explanation":
    case "ai-quiz":
    case "ai-pedagogical-sheet":
    case "ai-simplify":
    case "ai-lesson-plan":
    case "ai-exam": {
      if (!text.trim()) throw new Error("Saisissez du texte");
      const res = await fetch(`/api/tools/${tool.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Erreur serveur");
      }
      const data = (await res.json()) as { result: string; provider: string };
      return data.result;
    }
    default:
      throw new Error("Outil non implémenté");
  }
}

export default function ToolsPage() {
  const { can } = useAuth();
  const [category, setCategory] = useState<ToolCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => loadSet(FAVORITES_KEY));
  const [recentTools, setRecentTools] = useState<string[]>(() => loadSet(RECENT_KEY));
  const [activeTool, setActiveTool] = useState<ToolDefinition | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const base = category === "all" ? TOOLS : TOOLS.filter((t) => t.category === category);
    if (!query.trim()) return base;
    const needle = query.toLowerCase();
    return base.filter((t) => t.name.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle));
  }, [category, query]);

  const favTools = useMemo(() => TOOLS.filter((t) => favorites.includes(t.id)), [favorites]);
  const recent = useMemo(() => recentTools.map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean) as ToolDefinition[], [recentTools]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveSet(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const openTool = useCallback((t: ToolDefinition) => {
    setActiveTool(t);
    setResult(null);
    setFile(null);
    setText("");
    setStatus("idle");
    setError("");
    if (resultUrl) { URL.revokeObjectURL(resultUrl); setResultUrl(null); }
    setRecentTools((prev) => {
      const next = [t.id, ...prev.filter((x) => x !== t.id)].slice(0, 8);
      saveSet(RECENT_KEY, next);
      return next;
    });
  }, [resultUrl]);

  const closeTool = useCallback(() => {
    if (resultUrl) { URL.revokeObjectURL(resultUrl); setResultUrl(null); }
    setActiveTool(null);
    setResult(null);
    setStatus("idle");
    setError("");
  }, [resultUrl]);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const execute = useCallback(async () => {
    if (!activeTool) return;
    setStatus("running");
    setError("");
    setResult(null);
    if (resultUrl) { URL.revokeObjectURL(resultUrl); setResultUrl(null); }
    try {
      const out = await runTool(activeTool, file, text);
      setResult(out);
      if (typeof out === "object" && out !== null && "url" in out && typeof (out as { url: unknown }).url === "string") {
        setResultUrl((out as { url: string }).url);
      }
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setStatus("error");
    }
  }, [activeTool, file, text, resultUrl]);

  const restart = useCallback(() => {
    setResult(null);
    setStatus("idle");
    setError("");
    if (resultUrl) { URL.revokeObjectURL(resultUrl); setResultUrl(null); }
    if (activeTool?.requirements?.file) {
      const fileInput = document.querySelector("input[type=file]") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      setFile(null);
    }
    setText("");
  }, [resultUrl, activeTool]);

  const toolIcon = (t: ToolDefinition) => ICONS[t.icon] ?? Wrench;
  const params = activeTool ? getToolTextParam(activeTool) : { label: "Texte", placeholder: "", hint: "" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="EduSync Tools"
        subtitle="Centre d'outils scolaires — PDF, Images, Données, IA"
        action={
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-success/12 px-3 py-1 font-semibold text-success">
              {TOOLS.filter((t) => t.status === "available").length} disponibles
            </span>
            <span className="rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground">
              {TOOLS.filter((t) => t.status === "coming_soon").length} bientôt
            </span>
          </div>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Rechercher un outil..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border bg-card pl-10 pr-4 py-2.5 text-sm shadow-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory("all")}
          className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", category === "all" ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")}
        >
          Tous ({TOOLS.length})
        </button>
        {(Object.keys(TOOL_CATEGORIES) as ToolCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", category === c ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")}
          >
            {TOOL_CATEGORIES[c].label} ({TOOLS.filter((t) => t.category === c).length})
          </button>
        ))}
      </div>

      {!can("tools.use") && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          Vous n'avez pas la permission d'utiliser les outils.
        </p>
      )}

      {favTools.length > 0 && category === "all" && !query && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Star className="size-4 text-amber-500" /> Favoris</h3>
          <ToolGrid tools={favTools} onOpen={openTool} onFav={toggleFavorite} favorites={favorites} iconFor={toolIcon} />
        </section>
      )}

      {recent.length > 0 && category === "all" && !query && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Clock className="size-4" /> Récents</h3>
          <ToolGrid tools={recent} onOpen={openTool} onFav={toggleFavorite} favorites={favorites} iconFor={toolIcon} />
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-bold">
          {category === "all" ? "Tous les outils" : TOOL_CATEGORIES[category].label} ({filtered.length})
        </h3>
        {filtered.length === 0 ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Aucun outil trouvé.</p>
        ) : (
          <ToolGrid tools={filtered} onOpen={openTool} onFav={toggleFavorite} favorites={favorites} iconFor={toolIcon} />
        )}
      </section>

      {activeTool && (
        <ToolPanel
          tool={activeTool}
          file={file}
          setFile={setFile}
          text={text}
          setText={setText}
          result={result}
          status={status}
          error={error}
          onClose={closeTool}
          onExecute={execute}
          onRestart={restart}
          iconFor={toolIcon}
          params={params}
        />
      )}
    </div>
  );
}

function ToolGrid({ tools, onOpen, onFav, favorites, iconFor }: {
  tools: ToolDefinition[];
  onOpen: (t: ToolDefinition) => void;
  onFav: (id: string) => void;
  favorites: string[];
  iconFor: (t: ToolDefinition) => LucideIcon;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((t) => {
        const Icon = iconFor(t);
        const isFav = favorites.includes(t.id);
        return (
          <div
            key={t.id}
            className={cn(
              "group relative rounded-xl border bg-card p-4 transition-shadow hover:shadow-md",
              t.status !== "available" && "opacity-60",
            )}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onFav(t.id); }}
              className="absolute right-3 top-3"
              aria-label="Favori"
            >
              <Star className={cn("size-4", isFav ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
            </button>
            <button onClick={() => onOpen(t)} disabled={t.status !== "available"} className="flex w-full items-start gap-3 text-left">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t.name}</span>
                <span className="block text-xs text-muted-foreground">{t.description}</span>
                {t.status === "coming_soon" && (
                  <div className="mt-1 space-y-1">
                    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">BIENTÔT</span>
                    {t.comingSoonReason && <p className="text-[10px] text-muted-foreground">{t.comingSoonReason}</p>}
                  </div>
                )}
                {t.status === "beta" && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">BETA</span>}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ToolPanel({ tool, file, setFile, text, setText, result, status, error, onClose, onExecute, onRestart, iconFor, params }: {
  tool: ToolDefinition;
  file: File | null;
  setFile: (f: File | null) => void;
  text: string;
  setText: (s: string) => void;
  result: unknown;
  status: "idle" | "running" | "success" | "error";
  error: string;
  onClose: () => void;
  onExecute: () => void;
  onRestart: () => void;
  iconFor: (t: ToolDefinition) => LucideIcon;
  params: { label: string; placeholder: string; hint: string };
}) {
  const Icon = iconComp(tool);
  const isResultObject = typeof result === "object" && result !== null && "url" in result && "name" in result;
  const isValidationResult = typeof result === "object" && result !== null && "valid" in result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent">
          <X className="size-5" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold">{tool.name}</h2>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
        </div>

        {tool.inputFormats && tool.inputFormats.length > 0 && (
          <p className="mb-2 text-xs text-muted-foreground">
            Formats acceptés : {tool.inputFormats.join(", ")}
          </p>
        )}

        {tool.requirements?.file && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Fichier</label>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                <Upload className="size-4" />
                <span>{file ? file.name : "Choisir un fichier"}</span>
                <input
                  type="file"
                  accept={tool.inputFormats?.join(",")}
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {tool.requirements?.text && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">{params.label}</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder={params.placeholder}
            />
            {params.hint && <p className="mt-1 text-xs text-muted-foreground">{params.hint}</p>}
            {tool.requirements.ai && (
              <p className="mt-1 text-xs text-muted-foreground">{text.length}/20000 caractères</p>
            )}
          </div>
        )}

        <button
          onClick={onExecute}
          disabled={status === "running" || (!file && !text.trim())}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {status === "running" ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Traitement en cours...
            </span>
          ) : "Exécuter"}
        </button>

        {status === "error" && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {status === "success" && Boolean(result) && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {isResultObject ? "Résultat généré" : isValidationResult ? "Validation JSON" : "Résultat"}
              </span>
              {(isResultObject || isValidationResult) && (
                <button onClick={onRestart} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold">
                  <RefreshCw className="size-3" /> Recommencer
                </button>
              )}
            </div>

            <div className="rounded-lg border bg-accent p-3">
              {isValidationResult ? (
                <ValidationResult result={result as { valid: boolean; error: string | null; preview: string }} />
              ) : isResultObject ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{(result as { name: string }).name}</span>
                  <a
                    href={(result as { url: string }).url}
                    download={(result as { name: string }).name}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    <Download className="size-3" /> Télécharger
                  </a>
                </div>
              ) : (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm">{result as string}</pre>
              )}
            </div>
          </div>
        )}

        {tool.status === "coming_soon" && tool.comingSoonReason && (
          <p className="mt-3 text-xs text-muted-foreground">{tool.comingSoonReason}</p>
        )}
      </div>
    </div>
  );
}

function iconComp(tool: ToolDefinition): LucideIcon {
  return ICONS[tool.icon] ?? Wrench;
}

function ValidationResult({ result }: { result: { valid: boolean; error: string | null; preview: string } }) {
  return (
    <div className="space-y-2">
      <div className={cn("flex items-center gap-2 text-sm font-medium", result.valid ? "text-success" : "text-destructive")}>
        <CheckCircle className="size-4" />
        {result.valid ? "JSON valide" : "JSON invalide"}
      </div>
      {result.error && <p className="text-sm text-destructive">{result.error}</p>}
      {result.valid && result.preview && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">{result.preview}</pre>
      )}
    </div>
  );
}





