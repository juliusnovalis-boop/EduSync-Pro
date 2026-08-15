import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { ScanLine, Camera, QrCode, FileScan, CheckCircle2, XCircle, Loader2, RotateCw, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard, StatCard } from "../components/ui-kit";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui";

type ScanMode = "qr" | "document";
type ScanResult = { type: string; content: string; status: "success" | "error"; detail: string; timestamp: string };

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [mode, setMode] = useState<ScanMode>("qr");
  const [active, setActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setActive(false);
  }, []);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
    if (code && code.data) {
      void handleQrResult(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(scanLoop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleQrResult(data: string) {
    stopCamera();
    setScanning(false);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(data); } catch { /* QR non-JSON (URL, texte) */ }

    const qrType = String(parsed.type ?? "url");
    let status: ScanResult["status"] = "success";
    let detail = "";

    if (data.includes("/api/verify-qr/") || data.includes("verify-qr")) {
      const token = data.split("/").pop() ?? "";
      try {
        const res = await fetch(`/api/verify-qr/${encodeURIComponent(token)}`);
        const v = await res.json();
        status = v.valid ? "success" : "error";
        detail = v.result ?? "Invalide";
      } catch { detail = "Vérification impossible"; status = "error"; }
    } else if (parsed.type === "attendance") {
      detail = "Séance de présence détectée — pointage effectué";
      status = "success";
      // Enregistre le pointage QR
      try {
        await fetch("/api/data/qr_scan_history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: String(parsed.token ?? ""), type: "attendance", result: "Pointage de présence scanné" }),
        });
      } catch { /* ignore */ }
    } else if (parsed.type === "student" || parsed.type === "class") {
      detail = `QR ${qrType} « ${String(parsed.name ?? "")} » scanné avec succès`;
      status = "success";
    } else {
      detail = `QR ${qrType} scanné avec succès`;
    }

    const res: ScanResult = { type: qrType, content: data.slice(0, 100), status, detail, timestamp: new Date().toLocaleTimeString("fr-FR") };
    setResult(res);
    setHistory((h) => [res, ...h].slice(0, 20));
    toast(status === "success" ? "QR scanné ✓" : "QR invalide", { description: detail });
  }

  async function startCamera() {
    setResult(null);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      if (mode === "qr") { setScanning(true); rafRef.current = requestAnimationFrame(scanLoop); }
    } catch {
      toast.error("Caméra inaccessible", { description: "Autorisez l'accès caméra dans votre navigateur." });
    }
  }

  function captureDocument() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    toast.success("Document capturé", { description: "Lancez l'OCR pour extraire le texte." });
  }

  async function runOcr() {
    if (!capturedImage) return;
    setOcrLoading(true);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage, classId: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "OCR échoué");
      const res2: ScanResult = { type: "document", content: `${data.count ?? 0} note(s) extraite(s)`, status: "success", detail: "OCR terminé — texte reconnu", timestamp: new Date().toLocaleTimeString("fr-FR") };
      setResult(res2);
      setHistory((h) => [res2, ...h].slice(0, 20));
      toast.success("OCR terminé", { description: `${data.count ?? 0} éléments extraits` });
    } catch (e) {
      toast.error("OCR échoué", { description: (e as Error).message });
    } finally {
      setOcrLoading(false);
    }
  }

  function downloadCaptured() {
    if (!capturedImage) return;
    const link = document.createElement("a");
    link.href = capturedImage;
    link.download = `scan-${Date.now()}.jpg`;
    link.click();
  }

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (active && mode === "qr" && scanning) { rafRef.current = requestAnimationFrame(scanLoop); }
  }, [active, mode, scanning, scanLoop]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="Scanner universel" subtitle="Scannez QR codes et documents via la caméra — avec OCR et vérification." />

      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <StatCard label="Mode" value={mode === "qr" ? "QR Code" : "Document"} icon={ScanLine} tone="violet" />
        <StatCard label="Caméra" value={active ? "Active" : "Arrêtée"} icon={Camera} tone={active ? "green" : "amber"} />
        <StatCard label="Scans" value={history.length} icon={CheckCircle2} tone="blue" />
      </div>

      <Tabs defaultValue="qr" onValueChange={(v) => { stopCamera(); setMode(v as ScanMode); setResult(null); setCapturedImage(null); }}>
        <TabsList>
          <TabsTrigger value="qr"><QrCode className="mr-1 size-4" /> QR Code</TabsTrigger>
          <TabsTrigger value="document"><FileScan className="mr-1 size-4" /> Document</TabsTrigger>
        </TabsList>

        <TabsContent value="qr" className="mt-5">
          <SectionCard title="Scanner un QR Code" description="Pointez la caméra vers un QR code EduSync ou externe" icon={QrCode}>
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-full max-w-md overflow-hidden rounded-xl border-2 border-border bg-slate-950" style={{ aspectRatio: "4/3" }}>
                {active ? (
                  <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-slate-400">
                    <QrCode className="size-12 opacity-40" />
                    <p className="mt-2 text-sm">Caméra inactive</p>
                  </div>
                )}
                {active && scanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="size-48 rounded-xl border-2 border-primary/70" />
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-2">
                {!active ? (
                  <Button onClick={startCamera}><Camera className="mr-2 size-4" /> Activer la caméra</Button>
                ) : (
                  <>
                    {scanning && <Pill tone="info"><Loader2 className="mr-1 size-3 animate-spin" /> Recherche en cours...</Pill>}
                    <Button variant="outline" onClick={stopCamera}>Arrêter</Button>
                  </>
                )}
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="document" className="mt-5">
          <SectionCard title="Capturer un document" description="Prenez en photo un document puis lancez l'OCR" icon={FileScan}>
            <div className="flex flex-col items-center gap-4">
              {capturedImage ? (
                <div className="w-full max-w-md">
                  <img src={capturedImage} alt="Document capturé" className="w-full rounded-xl border border-border" />
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Button onClick={runOcr} disabled={ocrLoading}>{ocrLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileScan className="mr-2 size-4" />} Lancer l'OCR</Button>
                    <Button variant="outline" onClick={downloadCaptured}><ImageDown className="mr-2 size-4" /> Télécharger</Button>
                    <Button variant="outline" onClick={() => { setCapturedImage(null); void startCamera(); }}><RotateCw className="mr-2 size-4" /> Reprendre</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative w-full max-w-md overflow-hidden rounded-xl border-2 border-border bg-slate-950" style={{ aspectRatio: "4/3" }}>
                    {active ? (
                      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-slate-400">
                        <FileScan className="size-12 opacity-40" />
                        <p className="mt-2 text-sm">Caméra inactive</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!active ? (
                      <Button onClick={startCamera}><Camera className="mr-2 size-4" /> Activer la caméra</Button>
                    ) : (
                      <>
                        <Button onClick={captureDocument}><Camera className="mr-2 size-4" /> Capturer</Button>
                        <Button variant="outline" onClick={stopCamera}>Arrêter</Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {result && (
        <div className="mt-6">
          <SectionCard title="Résultat du scan">
            <div className="flex items-start gap-3 rounded-xl border border-border p-4">
              {result.status === "success" ? <CheckCircle2 className="size-6 shrink-0 text-success" /> : <XCircle className="size-6 shrink-0 text-destructive" />}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{result.detail}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{result.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">{result.timestamp}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <SectionCard title="Historique des scans" description={`${history.length} scan(s)`}>
            <ul className="space-y-2">
              {history.map((h, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                  {h.status === "success" ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
                  <span className="font-medium">{h.detail}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{h.timestamp}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
