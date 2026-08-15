import { NextRequest, NextResponse } from "next/server";
import { verifySession, revokeSession, clearSessionCookie } from "@/lib/server/auth";
import { detectEnvironment } from "@/lib/server/environment";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — DÉCONNEXION SÉCURISÉE.
 *  1. révoque la session côté serveur (impossible de la réutiliser, même avant expiration) ;
 *  2. supprime le cookie HttpOnly côté navigateur ;
 *  3. le frontend vide aussi son état local.
 */
export async function POST(req: NextRequest) {
  try {
    const v = await verifySession(req);
    if (v) {
      await revokeSession(v.sessionId, "logout");
    }
    const env = v?.environment ?? detectEnvironment(req) ?? "production";
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res, env);
    return res;
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
