import { NextRequest, NextResponse } from "next/server";
import { aiGateway, AiGatewayError, type AiTaskType } from "@/lib/server/ai-gateway";
import { aiGuard } from "@/lib/server/ai-guard";
import { PERMISSIONS } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/** Valeurs taskType supportées par le pipeline (miroir du type AiTaskType —
 * validation d'entrée HTTP uniquement : la politique FREE reste dans ai-policy). */
const VALID_TASK_TYPES: ReadonlySet<string> = new Set(["quick", "standard", "analysis", "vision", "json", "audio"]);

/** Bornes anti-abus — aucune limite n'existait auparavant sur cette route.
 * Calibrées pour un usage pédagogique, très en dessous des limites providers. */
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 20_000;
const MAX_CACHE_KEY_CHARS = 200;

/** Internal/public API boundary for the server-side AI Gateway. Identity and scope
 * come only from the existing authenticated session, never from the request body. */
export async function POST(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_USE, "gateway", "generate");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Corps de requête invalide : objet JSON attendu." }, { status: 400 });
    }
    const raw = body as { taskType?: unknown; messages?: unknown; model?: unknown; useCache?: unknown; cacheKey?: unknown };

    // taskType : uniquement les valeurs supportées par le pipeline.
    const taskType: AiTaskType = raw.taskType === undefined || raw.taskType === null
      ? "standard"
      : (typeof raw.taskType === "string" && VALID_TASK_TYPES.has(raw.taskType) ? raw.taskType as AiTaskType : null!);
    if (!taskType) {
      return NextResponse.json({ error: "taskType non supporté." }, { status: 400 });
    }

    // model : chaîne optionnelle — la gratuité reste validée exclusivement par aiRouter/aiPolicy.
    if (raw.model !== undefined && raw.model !== null && typeof raw.model !== "string") {
      return NextResponse.json({ error: "model doit être une chaîne." }, { status: 400 });
    }

    // cacheKey : borne de taille (utilisé uniquement comme clé de cache locale).
    if (raw.cacheKey !== undefined && raw.cacheKey !== null && (typeof raw.cacheKey !== "string" || raw.cacheKey.length > MAX_CACHE_KEY_CHARS)) {
      return NextResponse.json({ error: `cacheKey invalide (chaîne de ${MAX_CACHE_KEY_CHARS} caractères maximum).` }, { status: 400 });
    }

    // messages : tableau obligatoire, borné, chaque entrée { role, content } valides.
    if (!Array.isArray(raw.messages)) {
      return NextResponse.json({ error: "messages doit être un tableau." }, { status: 400 });
    }
    if (raw.messages.length > MAX_MESSAGES) {
      return NextResponse.json({ error: `Trop de messages (${MAX_MESSAGES} maximum).` }, { status: 400 });
    }
    const messages: Array<{ role: string; content: string }> = [];
    for (const entry of raw.messages) {
      if (typeof entry !== "object" || entry === null) {
        return NextResponse.json({ error: "Chaque message doit être un objet { role, content }." }, { status: 400 });
      }
      const { role, content } = entry as { role?: unknown; content?: unknown };
      if (typeof role !== "string" || typeof content !== "string") {
        return NextResponse.json({ error: "Chaque message requiert role (chaîne) et content (chaîne)." }, { status: 400 });
      }
      if (content.length > MAX_CONTENT_CHARS) {
        return NextResponse.json({ error: `Contenu de message trop volumineux (${MAX_CONTENT_CHARS} caractères maximum).` }, { status: 400 });
      }
      messages.push({ role, content });
    }

    const response = await aiGateway({ userId: guard.ctx.userId, role: guard.ctx.role, schoolId: guard.ctx.schoolId, environment: guard.environment, taskType, messages, model: raw.model ?? undefined, useCache: raw.useCache === true, cacheKey: raw.cacheKey as string | undefined });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AiGatewayError) {
      const status = error.code === "QUOTA_EXCEEDED" || error.code === "RATE_LIMITED" ? 429 : error.code === "FREE_SERVICE_UNAVAILABLE" ? 503 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Erreur interne de la passerelle IA." }, { status: 500 });
  }
}
