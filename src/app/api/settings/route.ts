import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { PERMISSIONS } from "@/lib/server/rbac";
import { logAudit, AUDIT_ACTIONS } from "@/lib/server/audit";
import { getAiSettings, setAiSettings } from "@/lib/server/ai";
import { checkModelIsFree, type AiProviderId } from "@/lib/server/ai-gateway";
import { safeParseJson, clientIp, internalErrorResponse } from "@/lib/server/security";
import { loginRateLimiter, SETTINGS_ENDPOINT_LIMIT, ensureRateLimitSchema } from "@/lib/server/security";

export const dynamic = "force-dynamic";

/**
 * /api/settings — configuration IA.
 *
 * Durci (pentest #3 & #4) :
 *   • GET protégé par la même authentification que le PUT (401 si non connecté).
 *   • Aucun secret n'est jamais renvoyé : `getAiSettings()` ne lit que des
 *     préférences (provider/modèle/longueur) — les clés fournisseur LLM ne vivent
 *     QUE dans les variables d'environnement serveur (jamais en base, jamais au client).
 *   • PUT soumis au rate limiting persistant par IP et au Content-Type JSON strict.
 *   • Erreurs internes → 500 générique JSON sans stack trace.
 */

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.AI_CONFIGURE);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await getAiSettings());
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.AI_CONFIGURE);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Rate limiting persistant par IP.
  await ensureRateLimitSchema();
  const rl = await loginRateLimiter.checkEndpoint(clientIp(req), "settings:put", SETTINGS_ENDPOINT_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // Corps JSON strict (415 / 400, jamais de crash).
  const body = await safeParseJson<{ provider?: string; model?: string; length?: string }>(req);
  if (!body.ok) return body.response;

  try {
    const data = body.data ?? {};
    if (data.model) {
      // FREE ONLY s'applique au MODÈLE, pas au provider.
      const provider =
        data.provider === "openrouter" || data.provider === "tokenin" || data.provider === "ollama" || data.provider === "gemini"
          ? (data.provider as AiProviderId)
          : "gemini";
      if (!checkModelIsFree(provider, data.model).allowed) {
        return NextResponse.json({ error: "Modèle payant ou de prix inconnu : configuration refusée." }, { status: 400 });
      }
    }
    await setAiSettings({ provider: data.provider, model: data.model, length: data.length });
    await logAudit({
      actor_id: auth.actor.userId,
      actor_role: auth.actor.role,
      action: AUDIT_ACTIONS.API_CONFIGURATION_CHANGED,
      metadata: { provider: data.provider ?? null, length: data.length ?? null },
    });
    return NextResponse.json(await getAiSettings());
  } catch (error) {
    return internalErrorResponse(error);
  }
}