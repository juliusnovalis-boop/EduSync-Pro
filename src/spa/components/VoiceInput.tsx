import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui";
import { cn } from "../lib/utils";

/**
 * Bouton de dictée vocale : enregistre l'audio du micro, l'envoie à
 * /api/transcribe (Gemini / Whisper) puis ajoute le texte transcrit au champ cible.
 */
export function VoiceInput({
  onTranscribe,
  className,
  disabled,
}: {
  onTranscribe: (text: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [available, setAvailable] = useState<boolean | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetch("/api/transcribe")
      .then((r) => r.json())
      .then((d: { available: boolean }) => setAvailable(d.available))
      .catch(() => setAvailable(false));
  }, []);

  async function toggle() {
    if (state === "idle") await start();
    else if (state === "recording") stop();
  }

  async function start() {
    if (!available) return toast.error("Dictée vocale indisponible", { description: "Clé IA non configurée." });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        await transcribe(blob);
      };
      recorder.start();
      mediaRef.current = recorder;
      setState("recording");
    } catch {
      toast.error("Micro inaccessible", { description: "Autorisez l'accès au microphone." });
    }
  }

  function stop() {
    mediaRef.current?.stop();
    setState("transcribing");
  }

  async function transcribe(blob: Blob) {
    setState("transcribing");
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: blob.type || "audio/webm" }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Échec de la transcription");
      if (data.text?.trim()) {
        onTranscribe(data.text.trim());
        toast.success("Transcription ajoutée");
      } else {
        toast.info("Aucune parole détectée");
      }
    } catch (e) {
      toast.error("Transcription échouée", { description: (e as Error).message });
    } finally {
      setState("idle");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("shrink-0", state === "recording" && "animate-pulse border-destructive text-destructive", className)}
      onClick={toggle}
      disabled={disabled || state === "transcribing" || available === false}
      title={available === false ? "Dictée vocale indisponible (clé IA requise)" : "Dicter par la voix"}
    >
      {state === "transcribing" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "recording" ? (
        <Square className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
    </Button>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Lecture audio impossible"));
    reader.readAsDataURL(blob);
  });
}
