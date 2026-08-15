import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requirePermission } from "@/lib/server/auth";
import { PERMISSIONS } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/** GET /api/audit — journal d'audit (permission audit.read : ADMIN & SUPER_ADMIN). */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.AUDIT_READ);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(auditLogs.created_at)
    .limit(limit);

  // ordre descendant (plus récent d'abord)
  return NextResponse.json(rows.reverse());
}
