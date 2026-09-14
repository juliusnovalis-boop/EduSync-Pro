import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { listNotifications, markAllRead } from "@/lib/server/notifications";
import { PERMISSIONS } from "@/lib/server/rbac";
import {
  clientIp,
  internalErrorResponse,
  loginRateLimiter,
  SENSITIVE_ENDPOINT_LIMIT,
  ensureRateLimitSchema,
} from "@/lib/server/security";

export const dynamic = "force-dynamic";

/**
 * MODULE 10 — Centre de notifications unifié.
 *
 * Durci (pentest #1 & #4) : rate limiting persistant par IP (endpoint sensible),
 * erreurs internes → 500 générique JSON sans stack trace.
 *
 * GET  /api/notifications          → liste paginée + filtres + compteur non-lu
 * POST /api/notifications/read-all → marque tout comme lu
 */

export async function GET(req: NextRequest) {
  const actor = await requirePermission(req, PERMISSIONS.NOTIFICATIONS_READ);
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  await ensureRateLimitSchema();
  const rl = await loginRateLimiter.checkEndpoint(clientIp(req), "notifications:get", SENSITIVE_ENDPOINT_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
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
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const actor = await requirePermission(req, PERMISSIONS.NOTIFICATIONS_READ);
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  await ensureRateLimitSchema();
  const rl = await loginRateLimiter.checkEndpoint(clientIp(req), "notifications:post", SENSITIVE_ENDPOINT_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/read-all")) {
      await markAllRead(actor.actor.userId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    return internalErrorResponse(error);
  }
}