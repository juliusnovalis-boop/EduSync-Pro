import { NextRequest, NextResponse } from "next/server";
import { verifySession, revokeSession, clearSessionCookie } from "@/lib/server/auth";
import { detectEnvironment } from "@/lib/server/environment";
import { internalErrorResponse } from "@/lib/server/security";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — DÉCONNEXION SÉCURISÉE.
 *
 * Durci (pentest #8) : le comportement « ok:true sans authentification »
 * n'existe plus.
 *   • Si une session valide est présente → elle est RÉVOQUÉE côté serveur, le
 *     cookie est supprimé, réponse `200 { ok: true }`.
 *   • Si AUCUNE session valide → réponse `204 No Content` (idempotente, choix
 *     assumé & documenté) : il n'y a rien à révoquer, on renvoie un corps vide
 *     et on ne prétend pas avoir déconnecté un utilisateur inexistant.
 *   • Dans les deux cas le cookie HttpOnly est purgé (nettoyage idempotent).
 */
export async function POST(req: NextRequest) {
  try {
    const v = await verifySession(req);
    const environment = v?.environment ?? detectEnvironment(req) ?? "production";
    if (v) {
      await revokeSession(v.sessionId, "logout");
      const res = NextResponse.json({ ok: true });
      clearSessionCookie(res, environment);
      return res;
    }
    const res = new NextResponse(null, { status: 204 });
    clearSessionCookie(res, environment);
    return res;
  } catch (error) {
    console.error("[auth/logout]", error);
    return internalErrorResponse(error);
  }
}