/**
 * EDUSYNC PRO — Catalogue centralisé des modèles IA (Ollama Cloud) + prompts système.
 *
 * Source de vérité unique : le frontend ne connaît que des ALIAS pédagogiques
 * (default/general/education/reasoning/mathematics/fallback) — jamais les
 * identifiants techniques ni les fournisseurs. Les identifiants réels sont ceux
 * documentés par Ollama Cloud (docs.ollama.com/cloud) et restent surchargeables
 * par variables d'environnement (sans jamais y mettre de clé secrète).
 *
 * ⚠️ Ollama retire régulièrement d'anciens modèles cloud (retraits documentés) :
 * mettre à jour ces valeurs depuis https://ollama.com (GET /api/tags liste les
 * modèles réellement disponibles du compte).
 */

/** Identifiants valides documentés par Ollama Cloud (au moment de l'intégration). */
const DEFAULTS = {
  default: "gpt-oss:120b",
  general: "gpt-oss:120b",
  education: "gpt-oss:20b",
  reasoning: "deepseek-v4-flash",
  mathematics: "glm-5.2",
  fallback: "gpt-oss:20b",
} as const;

export type AiModelPurpose = keyof typeof DEFAULTS;

function envModel(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

/** Catalogue alias → identifiant Ollama Cloud réel (surchargeable par env). */
export const AI_MODELS: Record<AiModelPurpose, string> = {
  default: envModel("OLLAMA_MODEL_DEFAULT", DEFAULTS.default),
  general: envModel("OLLAMA_MODEL_GENERAL", DEFAULTS.general),
  education: envModel("OLLAMA_MODEL_EDUCATION", DEFAULTS.education),
  reasoning: envModel("OLLAMA_MODEL_REASONING", DEFAULTS.reasoning),
  mathematics: envModel("OLLAMA_MODEL_MATH", DEFAULTS.mathematics),
  fallback: envModel("OLLAMA_MODEL_FALLBACK", DEFAULTS.fallback),
};

/** Modèles autorisés côté serveur — tout autre identifiant est refusé au client. */
export const OLLAMA_ALLOWED_MODELS: readonly string[] = [...new Set(Object.values(AI_MODELS))];

/**
 * Résout un alias demandé par le client vers l'identifiant réel.
 * Accepte : un alias pédagogique ("education"…) ou un identifiant du catalogue.
 * Renvoie null si inconnu → le Router refusera (modèle non autorisé).
 */
export function resolveModelAlias(requested: string | undefined | null): string | null {
  if (!requested) return null;
  const key = requested.trim();
  if (!key) return null;
  if ((Object.keys(AI_MODELS) as AiModelPurpose[]).includes(key as AiModelPurpose)) {
    return AI_MODELS[key as AiModelPurpose];
  }
  return OLLAMA_ALLOWED_MODELS.includes(key) ? key : null;
}

/* ────────────────────────── Prompts système EduSync ────────────────────────── */

export type AiPromptAudience = "general" | "student" | "teacher" | "parent" | "admin";

export const SYSTEM_PROMPTS: Record<AiPromptAudience, string> = {
  general:
    "Tu es EduSync AI, l'assistant intégré de la plateforme scolaire EduSync Pro. Réponds en français, de manière claire, concise et structurée.",
  student:
    "Tu es EduSync AI, assistant pédagogique des élèves d'EduSync Pro. Explique avec patience, encourage la compréhension plutôt que la réponse toute faite, propose des méthodes et des exemples adaptés au niveau scolaire. Réponds en français.",
  teacher:
    "Tu es EduSync AI, assistant des enseignants d'EduSync Pro. Aide à la préparation de cours, exercices, grilles d'évaluation et à l'analyse pédagogique des résultats de classe. Sois précis et opérationnel. Réponds en français.",
  parent:
    "Tu es EduSync AI, assistant des parents d'EduSync Pro. Aide au suivi scolaire : interprétation des bulletins, conseils d'accompagnement à la maison, communication bienveillante avec l'établissement. Réponds en français.",
  admin:
    "Tu es EduSync AI, assistant administratif d'EduSync Pro. Aide aux statistiques, synthèses de gestion, rédaction de communications officielles et organisation scolaire. Sois factuel et concis. Réponds en français.",
};

/** Prompt système selon le rôle utilisateur (fallback : général). */
export function systemPromptForRole(role: string | null | undefined): string {
  switch ((role ?? "").toUpperCase()) {
    case "STUDENT": return SYSTEM_PROMPTS.student;
    case "TEACHER": return SYSTEM_PROMPTS.teacher;
    case "PARENT": return SYSTEM_PROMPTS.parent;
    case "ADMIN": return SYSTEM_PROMPTS.admin;
    case "SUPER_ADMIN": return SYSTEM_PROMPTS.admin;
    default: return SYSTEM_PROMPTS.general;
  }
}
