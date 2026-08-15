import { NextRequest, NextResponse } from "next/server";
import { geminiKey, isGeminiKey, hfToken, isHfToken, geminiTranscribe, hfTranscribe } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasGemini = isGeminiKey(geminiKey());
  const hasHf = isHfToken(hfToken());
  return NextResponse.json({
    available: hasGemini || hasHf,
    provider: hasGemini ? "gemini" : hasHf ? "huggingface" : null,
  });
}

export async function POST(req: NextRequest) {
  const hasGemini = isGeminiKey(geminiKey());
  const hasHf = isHfToken(hfToken());

  if (!hasGemini && !hasHf) {
    return NextResponse.json({ error: "Transcription indisponible : configurez GEMINI_API_KEY ou HF_TOKEN." }, { status: 501 });
  }
  try {
    const { audioBase64, mimeType } = (await req.json()) as { audioBase64?: string; mimeType?: string };
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return NextResponse.json({ error: "Fichier audio manquant." }, { status: 400 });
    }
    if (audioBase64.length > 20_000_000) {
      return NextResponse.json({ error: "Audio trop volumineux (max ~12 Mo)." }, { status: 413 });
    }

    const buffer = Buffer.from(audioBase64, "base64");
    const mime = String(mimeType || "audio/webm");

    let text: string;
    if (hasGemini) {
      try {
        text = await geminiTranscribe(buffer, mime);
      } catch (error) {
        console.error("[transcribe] gemini échec, fallback HF :", (error as Error).message);
        if (!hasHf) throw error;
        text = await hfTranscribe(buffer, mime);
      }
    } else {
      text = await hfTranscribe(buffer, mime);
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[transcribe] erreur :", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
