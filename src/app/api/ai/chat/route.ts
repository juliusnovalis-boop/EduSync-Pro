import { NextRequest, NextResponse } from "next/server";
import { aiGuard, saveAiMessage, listConversationMessages } from "@/lib/server/ai-guard";
import { aiGateway, AiGatewayError } from "@/lib/server/ai-gateway";
import { db } from "@/db";
import { eq, and, desc as descDrizzle } from "drizzle-orm";
import { aiConversations } from "@/db/schema";
import { PERMISSIONS } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/**
 * MODULE 4 / 6 / 7 — Assistants IA conversationnels.
 *
 * POST /api/ai/chat
 *   body: { message: string, conversationId?: string, context?: { studentId?: string, classId?: string } }
 *
 * GET /api/ai/chat?conversationId=...&limit=...  → historique
 * GET /api/ai/chat?conversations=1               → liste des conversations de l'utilisateur
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
    .where(and(
      eq(aiConversations.id, convId),
      eq(aiConversations.user_id, guard.ctx.userId),
    ))
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

  const body = (await req.json()) as {
    message?: string;
    conversationId?: string;
    context?: { studentId?: string; classId?: string };
  };

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message vide" }, { status: 400 });
  }

  // Déterminer le type de tâche
  const normRole = guard.ctx.role.toUpperCase();
  let taskType: "quick" | "standard" | "analysis" = "standard";
  if (normRole === "PARENT") taskType = "quick";
  else if (normRole === "STUDENT") taskType = "quick";
  else if (normRole === "ADMIN") taskType = "analysis";
  else if (normRole === "SUPER_ADMIN") taskType = "analysis";

  // No broad database export: feature-specific authorized context will be added
  // by dedicated tools, never by this generic conversational route.
  const dataContext = `Rôle: ${normRole}. Réponds uniquement à partir de la question fournie; n'invente aucune donnée EduSync.`;

  // Construction du message complet avec contexte
  const fullPrompt = `${dataContext}\n\nQuestion de l'utilisateur :\n${message}\n\nRéponds de manière utile, concise et pédagogique.`;

  try {
    const response = await aiGateway({ userId: guard.ctx.userId, role: guard.ctx.role, schoolId: guard.ctx.schoolId, environment: guard.environment, taskType, messages: [{ role: "user", content: fullPrompt }], useCache: false });

    // Persister la question utilisateur + réponse
    const userConvId = await saveAiMessage({
      userId: guard.ctx.userId,
      role: guard.ctx.role,
      assistantType: normRole.toLowerCase(),
      conversationId: body.conversationId,
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
    });
  } catch (err) {
    if (err instanceof AiGatewayError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "QUOTA_EXCEEDED" || err.code === "RATE_LIMITED" ? 429 : err.code === "FREE_SERVICE_UNAVAILABLE" ? 503 : 400 });
    return NextResponse.json({ error: "Erreur IA interne." }, { status: 500 });
  }
}
