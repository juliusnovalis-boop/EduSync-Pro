import { NextRequest, NextResponse } from "next/server";
import { aiGuard } from "@/lib/server/ai-guard";
import { aiGateway, AiGatewayError } from "@/lib/server/ai-gateway";
import { PERMISSIONS } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/** Outils IA texte — chacun réutilise l'AI Gateway existant (provider routing,
 * quotas, audit). Aucune nouvelle architecture fournisseur. */

const TOOL_PROMPTS: Record<string, (text: string) => string> = {
  "ai-summarize": (t) =>
    `Résume le texte suivant de manière claire et structurée (points clés en liste). Texte :\n\n${t}`,
  "ai-correct": (t) =>
    `Corrige les fautes d'orthographe, grammaire et ponctuation du texte suivant. Retourne uniquement le texte corrigé. Texte :\n\n${t}`,
  "ai-rephrase": (t) =>
    `Reformule le texte suivant de manière plus claire et plus fluide, en conservant le sens. Retourne uniquement la reformulation. Texte :\n\n${t}`,
  "ai-translate": (t) =>
    `Traduis le texte suivant en anglais (ou en français s'il est déjà en anglais). Retourne uniquement la traduction. Texte :\n\n${t}`,
  "ai-questions": (t) =>
    `À partir du texte suivant, génère 5 questions pédagogiques numérotées (mélange de questions de compréhension et de réflexion), suivies de leurs réponses. Texte :\n\n${t}`,
  "ai-exercises": (t) =>
    `À partir du texte suivant, génère 5 exercices pédagogiques numérotés avec consignes claires et corrigés. Texte :\n\n${t}`,
  "ai-revision": (t) =>
    `Transforme le texte suivant en fiche de révision structurée : titre, points clés en liste, définitions importantes, et un moyen mnémotechnique si pertinent. Texte :\n\n${t}`,
  "ai-explanation": (t) =>
    `Explique le concept suivant de manière claire, pédagogique et accessible, en incluant des exemples concrets. Concept :\n\n${t}`,
  "ai-quiz": (t) =>
    `À partir du texte suivant, génère un quiz avec 5 questions à choix multiples (4 options chacune, 1 réponse correcte). Indique la réponse correcte pour chaque question. Format : Q1. [question] / A) [opt1] / B) [opt2] / C) [opt3] / D) [opt4] / Réponse : [lettre]. Texte :\n\n${t}`,
  "ai-pedagogical-sheet": (t) =>
    `Transforme le texte suivant en fiche pédagogique structurée : objectifs d'apprentissage, contenu principal, méthodes actives, évaluation, durée estimée, matériel nécessaire. Texte :\n\n${t}`,
  "ai-simplify": (t) =>
    `Simplifie le texte suivant pour qu'il soit compréhensible par un élève du secondaire. Utilise un vocabulaire simple et des phrases courtes. Retourne uniquement le texte simplifié. Texte :\n\n${t}`,
  "ai-lesson-plan": (t) =>
    `Génère un plan de cours détaillé à partir du thème suivant : séquence d'introduction (5 min), développement (30 min), activité pratique (15 min), évaluation (10 min), conclusion (5 min). Inclus les objectifs, les compétences visées et les ressources nécessaires. Thème :\n\n${t}`,
  "ai-exam": (t) =>
    `Génère un sujet d'évaluation complêt (5 exercices) à partir du programme suivant, avec consignes détaillées et un corrigé complet. Programme :\n\n${t}`,
};

const MAX_TEXT_CHARS = 20_000;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tool: string }> },
) {
  const { tool } = await context.params;

  const guard = await aiGuard(req, PERMISSIONS.TOOLS_USE, "tools", tool);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const promptBuilder = TOOL_PROMPTS[tool];
  if (!promptBuilder) {
    return NextResponse.json({ error: "Outil inconnu ou non disponible côté serveur." }, { status: 404 });
  }

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "Texte requis." }, { status: 400 });
    }
    text = body.text.slice(0, MAX_TEXT_CHARS);
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  try {
    const response = await aiGateway({
      userId: guard.ctx.userId,
      role: guard.ctx.role,
      schoolId: guard.ctx.schoolId,
      environment: guard.environment,
      taskType: "standard",
      messages: [{ role: "user", content: promptBuilder(text) }],
      useCache: true,
      cacheKey: `${tool}:${text.slice(0, 120)}`,
    });
    return NextResponse.json({ result: response.content, provider: response.provider, cached: response.cached });
  } catch (e) {
    if (e instanceof AiGatewayError) {
      return NextResponse.json({ error: `Service IA indisponible (${e.code}).` }, { status: 503 });
    }
    return NextResponse.json({ error: "Erreur lors du traitement." }, { status: 500 });
  }
}