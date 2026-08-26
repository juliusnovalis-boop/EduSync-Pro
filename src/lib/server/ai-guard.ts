/**
 * EDUSYNC IA - COUCHE DE SECURITE (reutilise l'auth existante).
 */
import type { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations, aiConversationMessages, aiAccessLogs } from "@/db/schema";
import { can, normalizeRole } from "./rbac";
import { verifySession, type VerifiedSession } from "./auth";
import { detectEnvironment } from "./environment";

export type { VerifiedSession as AuthSession };

export interface AiContext {
  userId: string;
  role: string;
  permissions: string[];
  schoolId: string | null;
  environment: "demo" | "production";
}

export interface AiGuardResult { ok: true; ctx: AiContext; environment: "demo" | "production"; }
export interface AiGuardError { ok: false; error: string; status: number; }
export type AiGuardResponse = AiGuardResult | AiGuardError;

export async function logAiAccess(opts: {
  userId: string; role: string; resource: string; action: string;
  permission: string; granted: boolean; environment: "demo" | "production";
}) {
  try {
    await db.insert(aiAccessLogs).values({
      id: `${opts.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: opts.userId, role: opts.role, resource: opts.resource, action: opts.action,
      permission: opts.permission, granted: opts.granted, created_at: new Date().toISOString(),
    });
  } catch { /* ne doit jamais casser la demande */ }
}

export async function aiGuard(
  req: NextRequest,
  permission: string,
  resource: string,
  action: string,
): Promise<AiGuardResponse> {
  try {
    const session: VerifiedSession | null = await verifySession(req);
    if (!session) {
      await logAiAccess({ userId: "anonymous", role: "anonymous", resource, action, permission, granted: false, environment: "production" });
      return { ok: false, error: "Authentification requise", status: 401 };
    }

    const declared = detectEnvironment(req);
    if (declared !== null && declared !== session.environment) {
      await logAiAccess({ userId: session.userId, role: session.role, resource, action, permission, granted: false, environment: session.environment });
      return { ok: false, error: "Incohérence d'environnement (DEMO ≠ OFFICIEL)", status: 403 };
    }

    const environment: "demo" | "production" = session.environment === "demo" ? "demo" : "production";
    const hasPerm = can(session.role, permission) || session.permissions.includes(permission);
    if (!hasPerm) {
      await logAiAccess({ userId: session.userId, role: session.role, resource, action, permission, granted: false, environment });
      return { ok: false, error: "Permission insuffisante", status: 403 };
    }

    const normRole = normalizeRole(session.role);
    const ctx: AiContext = {
      userId: session.userId, role: normRole, permissions: session.permissions,
      schoolId: session.schoolId, environment,
    };

    await logAiAccess({ userId: ctx.userId, role: ctx.role, resource, action, permission, granted: true, environment });
    return { ok: true, ctx, environment };
  } catch (err) {
    console.error("[ai-guard] Erreur:", (err as Error).message);
    return { ok: false, error: "Erreur serveur", status: 500 };
  }
}

export async function saveAiMessage(opts: {
  userId: string; role: string; assistantType: string; conversationId?: string;
  messageRole: "user" | "assistant" | "system"; content: string; provider?: string; model?: string;
}): Promise<string> {
  const now = new Date().toISOString();
  let convId: string;

  if (opts.conversationId) {
    const existing = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(and(eq(aiConversations.id, opts.conversationId), eq(aiConversations.user_id, opts.userId)))
      .limit(1);
    if (!existing.length) {
      convId = `${opts.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await db.insert(aiConversations).values({
        id: convId, user_id: opts.userId, role: opts.role, assistant_type: opts.assistantType,
        model: opts.model ?? null, provider: opts.provider ?? null,
        title: opts.content.slice(0, 80) + "...", created_at: now, updated_at: now,
      });
    } else {
      convId = opts.conversationId;
    }
  } else {
    convId = `${opts.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(aiConversations).values({
      id: convId, user_id: opts.userId, role: opts.role, assistant_type: opts.assistantType,
      model: opts.model ?? null, provider: opts.provider ?? null, created_at: now, updated_at: now,
    });
  }

  const msgId = `${convId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(aiConversationMessages).values({
    id: msgId, conversation_id: convId, role: opts.messageRole, content: opts.content, created_at: now,
  });
  await db.update(aiConversations).set({ updated_at: now }).where(eq(aiConversations.id, convId));
  return convId;
}

export async function listConversationMessages(
  conversationId: string,
  limit = 100,
): Promise<Array<{ id: string; role: string; content: string; created_at: string }>> {
  const rows = await db
    .select({
      id: aiConversationMessages.id,
      role: aiConversationMessages.role,
      content: aiConversationMessages.content,
      created_at: aiConversationMessages.created_at,
    })
    .from(aiConversationMessages)
    .where(eq(aiConversationMessages.conversation_id, conversationId))
    .orderBy(aiConversationMessages.created_at)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id ?? "",
    role: r.role ?? "user",
    content: r.content ?? "",
    created_at: r.created_at ?? "",
  }));
}
