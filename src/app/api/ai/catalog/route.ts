import { NextRequest, NextResponse } from "next/server";
import { aiGuard } from "@/lib/server/ai-guard";
import { bindEnvironment } from "@/lib/server/environment";
import { PERMISSIONS } from "@/lib/server/rbac";
import { getAiProviderCatalog } from "@/lib/server/ai-provider-catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/catalog — Catalogue UNIFIÉ des providers IA (AIProviderCatalog).
 *
 *   GET → aiGuard (AUDIT_READ existante) → découverte dynamique serveur → rapport
 *
 * - OpenRouter : modèles à prix réel 0 via /api/v1/models (+ fallback openrouter/free).
 * - Ollama : modèles accessibles au compte via /api/tags + notion ollamaPlan.
 * - Hugging Face : état du crédit gratuit (HF_FREE_CREDIT_LIMIT/REMAINING) —
 *   BLOCKED si 0 ou inconnu, JAMAIS de fallback payant.
 * - AUCUNE clé n'est renvoyée : uniquement des métadonnées non sensibles.
 */
export async function GET(req: NextRequest) {
  const guard = await aiGuard(req, PERMISSIONS.AUDIT_READ, "ai-catalog", "read");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!["ADMIN", "SUPER_ADMIN"].includes(guard.ctx.role)) {
    return NextResponse.json({ error: "Catalogue IA réservé aux administrateurs." }, { status: 403 });
  }
  try {
    bindEnvironment(guard.environment);
    const forceRefresh = new URL(req.url).searchParams.get("refresh") === "1";
    const catalog = await getAiProviderCatalog(forceRefresh);
    return NextResponse.json(catalog);
  } catch (error) {
    console.error("[api/ai/catalog] échec catalogue :", (error as Error).message);
    return NextResponse.json({ error: "Catalogue IA indisponible." }, { status: 500 });
  }
}
