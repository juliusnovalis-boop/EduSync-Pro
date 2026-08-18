import { NextRequest, NextResponse } from "next/server";
import { listRows } from "@/lib/server/data";
import { detectAiProvider, aiProviderLabel } from "@/lib/server/ai";
import { aiGuard } from "@/lib/server/ai-guard";
import { PERMISSIONS } from "@/lib/server/rbac";
import { aiGateway, AiGatewayError } from "@/lib/server/ai-gateway";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_USE, "ocr", "get_status");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const provider = detectAiProvider();
  return NextResponse.json({ available: provider !== "local", provider, label: aiProviderLabel() });
}

export async function POST(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_USE, "ocr", "extract_grades");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const body = (await req.json()) as { classId?: string; image?: string };
    if (!body.image || !String(body.image).startsWith("data:image/")) {
      return NextResponse.json({ error: "Image manquante ou invalide." }, { status: 400 });
    }
    if (String(body.image).length > 6_000_000) {
      return NextResponse.json({ error: "Image trop volumineuse (max ~4 Mo)." }, { status: 413 });
    }

    const classId = body.classId ?? "";
    const allStudents = await listRows("students", { order: "last_name", ascending: true, limit: 5000 });
    const classStudents = allStudents.filter((s) => !classId || s.class_id === classId);
    if (classStudents.length === 0) {
      return NextResponse.json({ error: "Aucun élève dans cette classe pour la réconciliation." }, { status: 400 });
    }

    const roster = classStudents.map((s) => ({
      id: String(s.id),
      name: `${String(s.last_name ?? "").toUpperCase()} ${s.first_name ?? ""}`.trim(),
    }));
    const ocrParams = { imageDataUrl: body.image, students: roster };

    try {
      const response = await aiGateway({
        userId: guard.ctx.userId,
        role: guard.ctx.role,
        schoolId: guard.ctx.schoolId,
        environment: guard.environment,
        taskType: "vision",
        capability: "ocr",
        ocrInput: ocrParams,
      });
      const grades = JSON.parse(response.content) as Array<{ studentId: string; value: number }>;
      return NextResponse.json({ grades, count: grades.length, total: roster.length });
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
    console.error("[ocr] erreur :", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}