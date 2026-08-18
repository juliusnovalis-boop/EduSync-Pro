import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { PERMISSIONS } from "@/lib/server/rbac";
import { logAudit, AUDIT_ACTIONS } from "@/lib/server/audit";
import { getAiSettings, setAiSettings } from "@/lib/server/ai";
import { bindRequestEnvironment } from "@/lib/server/environment";
import { checkModelIsFree, type AiProviderId } from "@/lib/server/ai-gateway";

export const dynamic = "force-dynamic";

/** GET /api/settings — configuration IA courante (lecture ouverte aux identifiés). */
export async function GET(req: NextRequest) {
  bindRequestEnvironment(req);
  return NextResponse.json(await getAiSettings());
}

/** PUT /api/settings — réservé au Super Admin (permission system.configure / ai.configure). */
export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.AI_CONFIGURE);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = (await req.json()) as { provider?: string; model?: string; length?: string };
    if (body.model) {
      const provider = body.provider === "openrouter" ? "openrouter" : "gemini";
      if (!checkModelIsFree(provider as AiProviderId, body.model).allowed) {
        return NextResponse.json({ error: "Modèle payant ou de prix inconnu : configuration refusée." }, { status: 400 });
      }
    }
    await setAiSettings({ provider: body.provider, model: body.model, length: body.length });
    await logAudit({
      actor_id: auth.actor.userId,
      actor_role: auth.actor.role,
      action: AUDIT_ACTIONS.API_CONFIGURATION_CHANGED,
      metadata: { provider: body.provider ?? null, length: body.length ?? null },
    });
    return NextResponse.json(await getAiSettings());
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
