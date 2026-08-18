import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { setNotificationRead, deleteNotification } from "@/lib/server/notifications";
import { PERMISSIONS } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/**
 * MODULE 10 — Actions sur une notification individuelle.
 *
 * PUT    /api/notifications/[id]  → marquer lue/non-lue
 * DELETE /api/notifications/[id]  → supprimer
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission(req, PERMISSIONS.NOTIFICATIONS_READ);
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }
  const { id } = await params;
  const body = (await req.json()) as { read?: boolean };
  const ok = await setNotificationRead(actor.actor.userId, id, Boolean(body.read));
  if (!ok) return NextResponse.json({ error: "Notification introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission(req, PERMISSIONS.NOTIFICATIONS_READ);
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }
  const { id } = await params;
  const ok = await deleteNotification(actor.actor.userId, id);
  if (!ok) return NextResponse.json({ error: "Notification introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}