/**
 * EDUSYNC AI ROUTER — Couche de décision pure.
 *
 * Le Router ne fait QUE décider : il ne contacte jamais un provider.
 * Il consulte checkModelIsFree() / resolveFreeModels() / FREE_POLICY
 * et retourne une décision { provider, model, reason, fallbackChain }.
 *
 * fallbackChain = liste des étapes VALIDES (gratuites + compatibles) dans
 * l'ordre de priorité. Le gateway essaie chaque étape jusqu'à succès.
 *
 * Architecture :
 *   Route → aiGuard → aiGateway → aiRouter → provider
 */
import { checkModelIsFree, resolveFreeModels, PROVIDER_PRIORITY, type AiProviderId, type AiTaskType, type AiCapability } from "./ai-policy";
import { GEMINI_VISION_MODEL, GEMINI_TEXT_MODEL } from "./ai";
import { resolveModelAlias } from "./ai-models";

export interface AIRouterUserContext {
  userId: string;
  role: string;
  schoolId: string | null;
}

export interface AIRouterRequest {
  taskType: AiTaskType;
  capability: AiCapability;
  requestedModel?: string;
  preferredProvider?: AiProviderId;
  userContext: AIRouterUserContext;
  environment: "demo" | "production";
}

export interface AIRouterFallbackStep {
  provider: AiProviderId;
  model: string;
  reason: string;
}

export interface AIRouterDecision {
  provider: AiProviderId;
  model: string;
  reason: string;
  fallbackChain: AIRouterFallbackStep[];
}

export class AIRouterError extends Error {
  constructor(
    public readonly code: "PAID_OR_UNKNOWN_MODEL" | "FREE_SERVICE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "AIRouterError";
  }
}

/** Providers candidats par capability (ceux qui ont un adaptateur d'exécution).
 * 'ollama' n'est ajouté en candidat QUE si checkModelIsFree() le confirme gratuit ;
 * sans preuve FREE_VERIFIED il est ignoré automatiquement (voir bloc demandé-explicite). */
const CAPABILITY_PROVIDERS: Record<AiCapability, AiProviderId[]> = {
  chat: ["gemini", "openrouter", "ollama"],
  ocr: ["gemini"],
  transcribe: ["gemini"],
};

/** Modèle fixe par provider+capability (pour OCR/transcribe). */
function fixedModelFor(provider: AiProviderId, capability: AiCapability): string | null {
  if (provider === "gemini") {
    if (capability === "ocr") return GEMINI_VISION_MODEL;
    if (capability === "transcribe") return GEMINI_TEXT_MODEL;
  }
  return null;
}

export async function aiRouter(req: AIRouterRequest): Promise<AIRouterDecision> {
  const cap = req.capability ?? "chat";
  const fallbackChain: AIRouterFallbackStep[] = [];
  const candidates = req.preferredProvider
    ? [req.preferredProvider, ...PROVIDER_PRIORITY.filter((p: AiProviderId) => p !== req.preferredProvider)]
    : PROVIDER_PRIORITY;

    // 1. Modèle demandé explicitement
  if (req.requestedModel) {
    for (const provider of candidates) {
      if (!CAPABILITY_PROVIDERS[cap].includes(provider)) continue;
      let model = req.requestedModel;
      // Pour Ollama, le client manipule un ALIAS pédagogique (education/reasoning…),
      // jamais un identifiant brut. On résout l'alias vers l'ID réel, mais le passage
      // final reste bloqué par checkModelIsFree() (gratuité non-prouvée) tant que le
      // modèle n'est pas FREE_VERIFIED. Cela empêche toute contournement par ID.
      if (provider === "ollama") {
        const resolved = resolveModelAlias(req.requestedModel);
        if (!resolved) continue; // alias/modèle inconnu du catalogue Ollama → ignorer ce provider
        model = resolved;
      }
      const check = checkModelIsFree(provider, model);
      if (check.allowed) {
        fallbackChain.push({ provider, model, reason: `Modèle demandé ${model} confirmé gratuit sur ${provider}` });
      }
    }
    if (fallbackChain.length === 0) {
      throw new AIRouterError("PAID_OR_UNKNOWN_MODEL", "Le modèle demandé n'est pas confirmé gratuit.");
    }
    const first = fallbackChain[0];
    return { provider: first.provider, model: first.model, reason: first.reason, fallbackChain };
  }

  // 2. Sélection automatique par priorité
  for (const provider of candidates) {
    if (!CAPABILITY_PROVIDERS[cap].includes(provider)) continue;

    // Modèle fixe pour OCR/transcribe
    const fixed = fixedModelFor(provider, cap);
    if (fixed) {
      const check = checkModelIsFree(provider, fixed);
      if (check.allowed) {
        fallbackChain.push({ provider, model: fixed, reason: `Modèle gratuit ${fixed} (${cap}) sur ${provider}` });
      }
      continue;
    }

    // Modèles dynamiques pour chat
    try {
      const models = await resolveFreeModels(provider);
      const freeModels = models.filter((m) => m.verifiedFree && checkModelIsFree(provider, m.id).allowed);
      if (freeModels.length > 0) {
        fallbackChain.push({ provider, model: freeModels[0].id, reason: `Modèle gratuit ${freeModels[0].id} sur ${provider}` });
      }
    } catch { /* Provider non disponible — passer au suivant */ }
  }

  // 3. Aucun provider valide
  if (fallbackChain.length === 0) {
    throw new AIRouterError("FREE_SERVICE_UNAVAILABLE", "Le service IA gratuit correspondant à cette tâche est actuellement indisponible.");
  }
  const first = fallbackChain[0];
  return { provider: first.provider, model: first.model, reason: first.reason, fallbackChain };
}