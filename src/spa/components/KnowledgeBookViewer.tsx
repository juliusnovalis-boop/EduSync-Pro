import { useEffect, useState } from "react";
import { X, FileText, Maximize, Download, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Visionneuse PDF intégrée — ressources LOCALES autorisées (READ_IN_EDUSYNC).
 * Utilise le rendu natif du navigateur via iframe (pdf.js non installé).
 * Le fichier est servi par /api/knowledge/file/[id] qui applique le contrôle
 * d'accès multi-tenant. Le téléchargement n'est proposé que si le mode
 * DOWNLOAD_IN_EDUSYNC est autorisé.
 */
export default function KnowledgeBookViewer({
  resourceId,
  title,
  fileUrl,
  canDownload,
  onClose,
}: {
  resourceId: string;
  title: string;
  fileUrl: string | null;
  canDownload: boolean;
  onClose: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/knowledge/file/${resourceId}`, { method: "GET" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError((data as { error?: string }).error ?? "Impossible de charger le document.");
          return;
        }
        if (cancelled) return;
        setSrc(`/api/knowledge/file/${resourceId}?ts=${Date.now()}`);
      } catch {
        if (!cancelled) setError("Erreur réseau lors du chargement du document.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  function openFullscreen() {
    const el = document.getElementById("knowledge-viewer-frame");
    if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  function handleDownload() {
    if (!canDownload) return;
    window.open(`/api/knowledge/file/${resourceId}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/60 px-4 py-2 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0" />
          <span className="truncate text-sm font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={openFullscreen}
            title="Plein écran"
            className="rounded p-2 hover:bg-white/10"
          >
            <Maximize className="size-4" />
          </button>
          {canDownload && (
            <button
              onClick={handleDownload}
              title="Télécharger"
              className="rounded p-2 hover:bg-white/10"
            >
              <Download className="size-4" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Fermer"
            className="rounded p-2 hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/40 px-4 py-1 text-white">
        <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} className="rounded px-2 hover:bg-white/10">−</button>
        <span className="text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(2, z + 0.2))} className="rounded px-2 hover:bg-white/10">+</button>
        <span className="ml-2 text-[11px] text-white/50">Ajustez le zoom selon l'écran</span>
      </div>

      {/* Zone du document */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {error ? (
          <div className="flex max-w-md flex-col items-center gap-3 rounded-xl bg-white/5 p-8 text-center text-white">
            <AlertTriangle className="size-8 text-amber-400" />
            <p className="text-sm">{error}</p>
            <button onClick={onClose} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Fermer</button>
          </div>
        ) : src ? (
          <iframe
            id="knowledge-viewer-frame"
            key={src}
            src={src}
            title={title}
            className="h-full w-full rounded-lg border border-white/10 bg-white shadow-2xl"
            style={{ zoom }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-white/70">Chargement du document…</p>
          </div>
        )}
      </div>
    </div>
  );
}