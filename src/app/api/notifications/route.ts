import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { listNotifications, markAllRead, countUnread } from "@/lib/server/notifications";
import { PERMISSIONS, can } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/**
 * MODULE 10 — Centre de notifications unifié.
 *
 * GET  /api/notifications          → liste paginée + filtres + compteur non-lu
 * GET  /api/notifications/unread   → nombre de notifications non lues
 * POST /api/notifications/read-all → marque tout comme lu
 */

export async function GET(req: NextRequest) {
  const actor = await requirePermission(req, PERMISSIONS.NOTIFICATIONS_READ);
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }
  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? undefined;
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const result = await listNotifications({
    userId: actor.actor.userId,
    category,
    unreadOnly,
    limit,
    offset,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const actor = await requirePermission(req, PERMISSIONS.NOTIFICATIONS_READ);
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }
  const url = new URL(req.url);
  if (url.pathname.endsWith("/read-all")) {
    await markAllRead(actor.actor.userId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}