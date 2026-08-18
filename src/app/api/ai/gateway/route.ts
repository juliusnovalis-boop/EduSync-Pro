import { NextRequest, NextResponse } from "next/server";
import { aiGateway, AiGatewayError, type AiTaskType } from "@/lib/server/ai-gateway";
import { aiGuard } from "@/lib/server/ai-guard";
import { PERMISSIONS } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/** Internal/public API boundary for the server-side AI Gateway. Identity and scope
 * come only from the existing authenticated session, never from the request body. */
export async function POST(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_USE, "gateway", "generate");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const body = await req.json() as { taskType?: AiTaskType; messages?: Array<{ role?: string; content?: string }>; model?: string; useCache?: boolean; cacheKey?: string };
    const messages = (body.messages ?? []).flatMap((message) => typeof message.content === "string" && typeof message.role === "string" ? [{ role: message.role, content: message.content }] : []);
    const response = await aiGateway({ userId: guard.ctx.userId, role: guard.ctx.role, schoolId: guard.ctx.schoolId, environment: guard.environment, taskType: body.taskType ?? "standard", messages, model: body.model, useCache: body.useCache === true, cacheKey: body.cacheKey });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AiGatewayError) {
      const status = error.code === "QUOTA_EXCEEDED" || error.code === "RATE_LIMITED" ? 429 : error.code === "FREE_SERVICE_UNAVAILABLE" ? 503 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Erreur interne de la passerelle IA." }, { status: 500 });
  }
}
