import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — renvoie la session courante (vérifiée côté serveur depuis
 * le cookie HttpOnly). Source de vérité pour l'état d'authentification du frontend.
 * 401 si aucune session valide (révoquée / expirée / compte suspendu).
 */
export async function GET(req: NextRequest) {
  const v = await verifySession(req);
  if (!v) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    session: {
      userId: v.userId,
      loginId: v.loginId,
      name: v.name,
      email: v.email,
      role: v.role,
      status: v.status,
      schoolId: v.schoolId,
      isSuperAdmin: v.role === "SUPER_ADMIN",
      mustChangePassword: v.mustChangePassword,
      permissions: v.permissions,
      environment: v.environment,
    },
  });
}
