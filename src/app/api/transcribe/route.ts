import { NextRequest, NextResponse } from "next/server";
import { detectAiProvider, aiProviderLabel } from "@/lib/server/ai";
import { aiGuard } from "@/lib/server/ai-guard";
import { PERMISSIONS } from "@/lib/server/rbac";
import { aiGateway, AiGatewayError } from "@/lib/server/ai-gateway";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_USE, "transcribe", "get_status");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const provider = detectAiProvider();
  return NextResponse.json({ available: provider !== "local", provider, label: aiProviderLabel() });
}

export async function POST(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_USE, "transcribe", "transcribe_audio");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { audioBase64, mimeType } = (await req.json()) as { audioBase64?: string; mimeType?: string };
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return NextResponse.json({ error: "Fichier audio manquant." }, { status: 400 });
    }
    if (audioBase64.length > 20_000_000) {
      return NextResponse.json({ error: "Audio trop volumineux (max ~12 Mo)." }, { status: 413 });
    }

    const mime = String(mimeType || "audio/webm");

    try {
      const response = await aiGateway({
        userId: guard.ctx.userId,
        role: guard.ctx.role,
        schoolId: guard.ctx.schoolId,
        environment: guard.environment,
        taskType: "audio",
        capability: "transcribe",
        transcribeInput: { audioBase64, mimeType: mime },
      });
      return NextResponse.json({ text: response.content });
    } catch (gwErr) {
      if (gwErr instanceof AiGatewayError && gwErr.code === "FREE_SERVICE_UNAVAILABLE") {
        return NextResponse.json(
          { error: "Le service IA gratuit correspondant à cette tâche est actuellement indisponible." },
          { status: 503 },
        );
      }
      throw gwErr;
    }
  } catch (error) {
    console.error("[transcribe] erreur :", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}