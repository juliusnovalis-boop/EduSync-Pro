import { NextRequest, NextResponse } from "next/server";
import { listRows } from "@/lib/server/data";
import { buildDataContext, buildSystemPrompt, cleanAiOutput, localSchoolAnalysis, getAiSettings, GEMINI_TEXT_MODEL, detectAiProvider, aiProviderLabel } from "@/lib/server/ai";
import { aiGuard } from "@/lib/server/ai-guard";
import { PERMISSIONS } from "@/lib/server/rbac";
import { aiGateway, AiGatewayError } from "@/lib/server/ai-gateway";

export const dynamic = "force-dynamic";

const TERMS: Record<string, string> = {
  P1: "Palier 1", P2: "Palier 2", P3: "Palier 3", P4: "Palier 4", P5: "Palier 5",
  T1: "Trimestre 1", T2: "Trimestre 2", T3: "Trimestre 3",
};

export async function GET(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_CLASS_ANALYSIS, "analysis", "get_status");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const provider = detectAiProvider();
  return NextResponse.json({ aiEnabled: provider !== "local", provider, label: aiProviderLabel() });
}

export async function POST(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_CLASS_ANALYSIS, "analysis", "analyze_class");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const settings = await getAiSettings();
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

    const dataContext = buildDataContext({
      term,
      termLabel: TERMS[term] ?? term,
      students,
      subjects,
      grades: grades as never,
      attendance: attendance as never,
      payments: payments as never,
      focus: focus || undefined,
    });

    const userPrompt = [dataContext, "", focus ? `AXE D'ANALYSE DEMANDE : ${focus}` : "Analyse globale de la periode.", "", "Redige le rapport maintenant."].join("\n");
    const systemPrompt = buildSystemPrompt();
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    try {
      const response = await aiGateway({
        userId: guard.ctx.userId,
        role: guard.ctx.role,
        schoolId: guard.ctx.schoolId,
        environment: guard.environment,
        taskType: "analysis",
        messages,
        model: settings.model || GEMINI_TEXT_MODEL,
        useCache: false,
      });
      return NextResponse.json({
        report: cleanAiOutput(response.content),
        term,
        termLabel: TERMS[term] ?? term,
        source: response.source,
        model: response.model,
        aiEnabled: true,
        label: aiProviderLabel(),
      });
    } catch (gwErr) {
      if (gwErr instanceof AiGatewayError && gwErr.code === "FREE_SERVICE_UNAVAILABLE") {
        const att = attendance.length
          ? (attendance.filter((a) => a.status === "present").length / attendance.length) * 100
          : 100;
        const revenue = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const report = localSchoolAnalysis({
          term,
          termLabel: TERMS[term] ?? term,
          students,
          subjects,
          grades: grades as never,
          attendance: attendance as never,
          payments: payments as never,
          focus: focus || undefined,
          attendanceRate: att,
          totalRevenue: revenue,
        });
        return NextResponse.json({
          report,
          term,
          termLabel: TERMS[term] ?? term,
          source: "local",
          model: "local",
          aiEnabled: false,
          label: aiProviderLabel(),
        });
      }
      throw gwErr;
    }
  } catch (error) {
    console.error("[api/ai]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}