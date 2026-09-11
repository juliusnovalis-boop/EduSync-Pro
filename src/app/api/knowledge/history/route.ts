import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { aiGuard } from "@/lib/server/ai-guard";
import { PERMISSIONS } from "@/lib/server/rbac";
import { db } from "@/db";
import { knowledgeHistory } from "@/db/schema";

export const dynamic = "force-dynamic";

const ACTIONS = ["OPEN", "READ", "DOWNLOAD", "EXTERNAL_OPEN"] as const;

/** POST — consigner une consultation (historique). */
export async function POST(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.KNOWLEDGE_READ, "knowledge", "history_log");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { resource_id?: unknown; action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  const resourceId = typeof body.resource_id === "string" && body.resource_id ? body.resource_id.slice(0, 200) : null;
  const action = ACTIONS.includes(body.action as never) ? (body.action as string) : "OPEN";
  if (!resourceId) return NextResponse.json({ error: "resource_id requis." }, { status: 400 });

  try {
    await db.insert(knowledgeHistory).values({
      id: `${guard.ctx.userId}-${Date.now()}-${randomUUID().slice(0, 6)}`,
      user_id: guard.ctx.userId,
      resource_id: resourceId,
      school_id: guard.ctx.schoolId,
      action,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // l'historique ne doit jamais bloquer la lecture
  }
}

/** GET — derniers éléments consultés par l'utilisateur courant. */
export async function GET(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.KNOWLEDGE_READ, "knowledge", "history_read");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const limit = Math.min(parseInt(new URL(req.url).searchParams.get("limit") ?? "20") || 20, 100);
  try {
    const rows = await db
      .select()
      .from(knowledgeHistory)
      .where(eq(knowledgeHistory.user_id, guard.ctx.userId))
      .orderBy(desc(knowledgeHistory.created_at))
      .limit(limit);
    return NextResponse.json({ items: rows, total: rows.length });
  } catch {
    return NextResponse.json({ items: [], total: 0 });
  }
}