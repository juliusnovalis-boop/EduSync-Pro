import { NextRequest, NextResponse } from "next/server";
import { listRows } from "@/lib/server/data";
import {
  detectAiProvider,
  hfToken,
  isHfToken,
  geminiOcrGrades,
  hfOcrGrades,
} from "@/lib/server/ai";
import { bindRequestEnvironment } from "@/lib/server/environment";

export const dynamic = "force-dynamic";

export async function GET() {
  const provider = detectAiProvider();
  return NextResponse.json({ available: provider !== "local", provider });
}

export async function POST(req: NextRequest) {
  bindRequestEnvironment(req);
  try {
    const provider = detectAiProvider();
    if (provider === "local") {
      return NextResponse.json(
        { error: "OCR indisponible : configurez GEMINI_API_KEY ou HF_TOKEN pour activer la reconnaissance par IA." },
        { status: 501 },
      );
    }

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

    let grades: Array<{ studentId: string; value: number }> = [];
    if (provider === "gemini") {
      try {
        grades = await geminiOcrGrades(ocrParams);
      } catch (error) {
        console.error("[ocr] gemini échec, fallback HF :", (error as Error).message);
        if (isHfToken(hfToken())) grades = await hfOcrGrades(ocrParams);
        else throw error;
      }
    } else {
      grades = await hfOcrGrades(ocrParams);
    }

    return NextResponse.json({ grades, count: grades.length, total: roster.length });
  } catch (error) {
    console.error("[ocr] erreur :", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
