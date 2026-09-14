import { NextRequest, NextResponse } from "next/server";
import { aiGuard, saveAiMessage, listConversationMessages } from "@/lib/server/ai-guard";
import { aiGateway, AiGatewayError } from "@/lib/server/ai-gateway";
import { db } from "@/db";
import { eq, and, desc as descDrizzle } from "drizzle-orm";
import { aiConversations } from "@/db/schema";
import { PERMISSIONS } from "@/lib/server/rbac";
import { buildCopilotPrompt, classifyIntent } from "@/lib/server/ai-copilot";
import {
  safeParseJson,
  clientIp,
  internalErrorResponse,
  loginRateLimiter,
  SENSITIVE_ENDPOINT_LIMIT,
  ensureRateLimitSchema,
} from "@/lib/server/security";

export const dynamic = "force-dynamic";

/**
 * /api/ai/chat — assistants IA conversationnels.
 *
 * Durci (pentest #1 & #4) :
 *   • POST soumis au rate limiting persistant par IP (endpoint sensible) ;
 *   • Content-Type JSON strict (415) + corps JSON sûr (400) — plus de 500 ;
 *   • erreurs internes → 500 générique JSON sans stack trace.
 */

export async function GET(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_ASSISTANT_USE, "chat", "chat_history");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const convId = url.searchParams.get("conversationId");
  const listConversations = url.searchParams.get("conversations") === "1";

  if (listConversations) {
    const rows = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.user_id, guard.ctx.userId))
      .orderBy(descDrizzle(aiConversations.updated_at));
    return NextResponse.json({ conversations: rows });
  }

  if (!convId) {
    return NextResponse.json({ error: "Paramètre manquant" }, { status: 400 });
  }

  // Vérifier que la conversation appartient bien à l'utilisateur.
  const owner = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, convId), eq(aiConversations.user_id, guard.ctx.userId)))
    .limit(1);
  if (!owner.length) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  const limit = Number(url.searchParams.get("limit") ?? 100);
  const messages = await listConversationMessages(convId, limit);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AI_ASSISTANT_USE, "chat", "chat");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // Rate limiting persistant par IP (endpoint sensible).
  await ensureRateLimitSchema();
  const rl = await loginRateLimiter.checkEndpoint(clientIp(req), "ai:chat", SENSITIVE_ENDPOINT_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // Corps JSON strict (415 / 400, jamais de crash).
  const body = await safeParseJson<{
    message?: string;
    conversationId?: string;
    context?: { studentId?: string; classId?: string };
  }>(req);
  if (!body.ok) return body.response;

  const message = (body.data?.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message vide" }, { status: 400 });
  }

  try {
  // 1) Classification d'intention → niveau de traitement (FREE ONLY inchangé).
  const normRole = guard.ctx.role.toUpperCase();
  const intent = classifyIntent(message);
  const taskType: "quick" | "standard" | "analysis" = intent;

  // 2) Contexte copilote : snapshot des données réellement autorisées (serveur).
  let systemPrompt = "";
  let sources: string[] = [];
  try {
    const copilot = await buildCopilotPrompt(guard.ctx, message);
    systemPrompt = copilot.system;
    sources = copilot.sources;
  } catch {
    /* contexte indisponible → réponse sans données */
  }

  // 3) Mémoire conversationnelle : historique existant en DB (20 derniers messages).
  const convId = body.data?.conversationId;
  const history = convId
    ? (await listConversationMessages(convId, 100))
        .slice(-20)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }))
    : [];

  // 4) Messages au provider : [system, ...historique, question]. Aucun appel direct.
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...history,
    { role: "user", content: message },
  ];
const response = await aiGateway({
      userId: guard.ctx.userId,
      role: guard.ctx.role,
      schoolId: guard.ctx.schoolId,
      environment: guard.environment,
      taskType,
      messages,
      useCache: false,
    });

    // Persister la question utilisateur + réponse
    const userConvId = await saveAiMessage({
      userId: guard.ctx.userId,
      role: guard.ctx.role,
      assistantType: normRole.toLowerCase(),
      conversationId: convId,
      messageRole: "user",
      content: message,
    });

    const assistantConvId = await saveAiMessage({
      userId: guard.ctx.userId,
      role: guard.ctx.role,
      assistantType: normRole.toLowerCase(),
      conversationId: userConvId,
      messageRole: "assistant",
      content: response.content,
      provider: response.source as any,
      model: response.model,
    });

    return NextResponse.json({
      message: response.content,
      conversationId: assistantConvId,
      source: response.source,
      model: response.model,
      aiEnabled: true,
      cached: response.cached,
      role: guard.ctx.role,
      intent,
      sources,
    });
  } catch (err) {
    if (err instanceof AiGatewayError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "QUOTA_EXCEEDED" || err.code === "RATE_LIMITED" ? 429 : err.code === "FREE_SERVICE_UNAVAILABLE" ? 503 : 400 });
    }
    return internalErrorResponse(err);
  }
}