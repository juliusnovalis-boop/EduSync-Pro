import { NextRequest, NextResponse } from "next/server";
import { listRows } from "@/lib/server/data";
import { generateAnalysis } from "@/lib/server/ai";
import { detectAiProvider, aiProviderLabel } from "@/lib/server/ai";
import { bindRequestEnvironment } from "@/lib/server/environment";

export const dynamic = "force-dynamic";

const TERMS: Record<string, string> = {
  P1: "Palier 1", P2: "Palier 2", P3: "Palier 3", P4: "Palier 4", P5: "Palier 5",
  T1: "Trimestre 1", T2: "Trimestre 2", T3: "Trimestre 3",
};

export async function GET() {
  const provider = detectAiProvider();
  return NextResponse.json({ aiEnabled: provider !== "local", provider, label: aiProviderLabel() });
}

export async function POST(req: NextRequest) {
  bindRequestEnvironment(req);
  try {
    const body = (await req.json()) as { term?: string; focus?: string };
    const term = body.term ?? "T1";
    const focus = body.focus ?? "";

    const [students, subjects, grades, attendance, payments] = await Promise.all([
      listRows("students"),
      listRows("subjects"),
      listRows("grades"),
      listRows("attendance"),
      listRows("payments"),
    ]);

    const result = await generateAnalysis({
      term,
      termLabel: TERMS[term] ?? term,
      students,
      subjects,
      grades: grades as never,
      attendance: attendance as never,
      payments: payments as never,
      focus: focus || undefined,
    });

    return NextResponse.json({
      report: result.report,
      term,
      termLabel: TERMS[term] ?? term,
      source: result.source,
      model: result.model,
      aiEnabled: result.source !== "local",
      label: aiProviderLabel(),
    });
  } catch (error) {
    console.error("[api/ai]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
