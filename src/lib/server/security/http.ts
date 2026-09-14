import { NextRequest, NextResponse } from "next/server";
import { ipFromForwarded } from "./policy";

/**
 * Utilitaires HTTP de sécurité — EduSync Pro.
 *
 * Objectifs :
 *  • valider le `Content-Type` des corps de requête (→ 415 si inattendu) ;
 *  • parser un corps JSON SANS jamais crasher (→ erreur JSON stable, pas de 500
 *    avec stack trace ni de corps vide) ;
 *  • extraire l'adresse IP réelle du client (délègue la logique pure à policy.ts) ;
 *  • renvoyer des erreurs GÉNÉRIQUES (JSON stable `{ "error": string }`),
 *    sans fuite de stack trace ni d'informations internes.
 */

/** Nombre maximal d'octets acceptés pour un corps JSON (anti-DoS). */
export const MAX_BODY_BYTES = 512 * 1024; // 512 KiB

/** Erreur JSON stable — le format utilisé par TOUTES les réponses d'erreur. */
export function stabilizeErrorPayload(error: string): { error: string } {
  return { error: String(error ?? "Erreur interne.") };
}

/** Réponse d'erreur JSON générique avec code HTTP correct. */
export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json(stabilizeErrorPayload(message), { status });
}

/** Message générique pour les erreurs 5xx inattendues (aucune fuite d'info). */
export function internalErrorResponse(error: unknown): NextResponse {
  // On journalise la cause réelle côté serveur (utile au diagnostic)…
  console.error("[security/http] error:", error);
  // …mais on ne renvoie JAMAIS le message brut au client.
  return jsonError(500, "Erreur interne du serveur.");
}

interface ContentTypeResult {
  ok: boolean;
  /** `response` n'est défini que si `ok === false` (réponse 415 prête à renvoyer). */
  response?: NextResponse;
}

/**
 * Vérifie que le corps d'une requête au corps attendu est bien du JSON.
 * Les requêtes SANS corps (GET/HEAD/DELETE sans body) et OPTIONS passent.
 * Renvoie `415 Unsupported Media Type` sinon (comportement demandé au pentest).
 */
export function requireJsonContentType(req: NextRequest): ContentTypeResult {
  const method = req.method.toUpperCase();
  // Pas de corps attendu → pas de contrainte de type.
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return { ok: true };
  }
  // Une mutation sans Content-Type JSON est toujours suspecte.
  const raw = req.headers.get("content-type") ?? "";
  const mediaType = raw.split(";")[0].trim().toLowerCase();
  if (mediaType === "application/json") {
    return { ok: true };
  }
  return {
    ok: false,
    response: jsonError(415, "Unsupported Media Type — Content-Type application/json requis."),
  };
}

/**
 * Parse un corps JSON de façon sûre. Ne lève JAMAIS :
 *  • si le corps est absent/vide → `{ ok: true, data: null }` (le routeur décide) ;
 *  • si le corps est invalide/forme tronquée → `{ ok: false, response: 400 }`.
 */
export async function safeParseJson<T = Record<string, unknown>>(
  req: NextRequest,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const type = requireJsonContentType(req);
  if (!type.ok) {
    return { ok: false, response: type.response as NextResponse };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, response: jsonError(400, "Corps de requête illisible.") };
  }
  if (!text || !text.trim()) {
    return { ok: true, data: null as unknown as T }; // corps vide → le routeur traite
  }
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    return { ok: false, response: jsonError(413, "Corps de requête trop volumineux.") };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, response: jsonError(400, "Corps de requête JSON invalide.") };
  }
}

/** Extrait l'IP réelle du client (x-forwarded-for puis x-real-ip). */
export function clientIp(req: NextRequest): string {
  return ipFromForwarded(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip"));
}