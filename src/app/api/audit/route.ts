import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requirePermission } from "@/lib/server/auth";
import { PERMISSIONS } from "@/lib/server/rbac";
import {
  clientIp,
  internalErrorResponse,
  loginRateLimiter,
  SENSITIVE_ENDPOINT_LIMIT,
  ensureRateLimitSchema,
} from "@/lib/server/security";

export const dynamic = "force-dynamic";

/** GET /api/audit — journal d'audit (permission audit.read : ADMIN & SUPER_ADMIN). */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.AUDIT_READ);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Rate limiting persistant par IP (endpoint sensible).
  await ensureRateLimitSchema();
  const rl = await loginRateLimiter.checkEndpoint(clientIp(req), "audit:get", SENSITIVE_ENDPOINT_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    const rows = await db
      .select()
      .from(auditLogs)
      .orderBy(auditLogs.created_at)
      .limit(limit);

    // ordre descendant (plus récent d'abord)
    return NextResponse.json(rows.reverse());
  } catch (error) {
    return internalErrorResponse(error);
  }
}