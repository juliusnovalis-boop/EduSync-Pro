import { NextRequest, NextResponse } from "next/server";
import { aiGuard } from "@/lib/server/ai-guard";
import { bindEnvironment } from "@/lib/server/environment";
import { PERMISSIONS } from "@/lib/server/rbac";
import { getAiHealth } from "@/lib/server/ai-health";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/health — AI Health Center (SUPER_ADMIN uniquement).
 *
 *   GET → aiGuard (AUDIT_READ existante) → restriction SUPER_ADMIN → checks serveur → rapport
 *
 * - Permission RBAC EXISTANTE réutilisée ; restriction SUPER_ADMIN car le rapport
 *   couvre l'ensemble des établissements et les deux environnements.
 * - L'environnement serveur suit toujours le jeton (bindEnvironment) ; le paramètre
 *   `env` du client n'est qu'une fenêtre de consultation séparée demo/production.
 * - Aucun provider réel n'est appelé : vérifications statiques de politique uniquement.
 */
export async function GET(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AUDIT_READ, "ai-health", "read");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (guard.ctx.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "AI Health Center réservé au Super Admin." }, { status: 403 });
  }

  try {
    bindEnvironment(guard.environment);

    const url = new URL(req.url);
    const rawEnv = url.searchParams.get("env");
    if (rawEnv !== null && rawEnv !== "demo" && rawEnv !== "production") {
      return NextResponse.json({ error: "env doit être demo ou production." }, { status: 400 });
    }
    const reportEnv = rawEnv === "demo" || rawEnv === "production" ? rawEnv : guard.environment;

    const health = await getAiHealth(reportEnv);
    return NextResponse.json(health);
  } catch (error) {
    console.error("[api/ai/health]", error);
    return NextResponse.json({ status: "UNHEALTHY", error: (error as Error).message }, { status: 500 });
  }
}
