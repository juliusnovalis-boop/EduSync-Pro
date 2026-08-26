/**
 * Implémentations concrètes des IAIProvider.
 *
 * ⚠ Phase 5B.1 — Ces classes sont désormais INERTES pour l'exécution :
 * - AIService exige un AIServiceAdapter (contexte Gateway) pour tout appel distant ;
 * - les chemins d'exécution legacy (chat/extractGrades/transcribe) ne sont plus
 *   invoqués par le Core : plus aucun bypass possible vers geminiChat/hfChat/…
 *   hors aiGateway.
 *
 * Elles restent exportées UNIQUEMENT pour :
 * - inspection/diagnostic (`available()`/`label()`/`priority()` dans core/status) ;
 * - compatibilité du barrel public `@/core` avec les modules non IA.
 *
 * Aucun code d'appel distant ne doit repasser par ces classes ; toute exécution
 * IA distante transite obligatoirement par : AIService → AIServiceAdapter → aiGateway.
 */
import {
  geminiKey,
  isGeminiKey,
  hfToken,
  isHfToken,
  geminiChat,
  geminiOcrGrades,
  geminiTranscribe,
  hfChat,
  hfOcrGrades,
  hfTranscribe,
} from "@/lib/server/ai";
import type { ChatMessage, ChatOptions, IAIProvider, OcrInput, OcrResult } from "./ai-provider";

export class GeminiProvider implements IAIProvider {
  readonly id = "gemini";
  readonly label = "Google Gemini";
  readonly priority = 10;
  readonly capabilities = { chat: true, vision: true, audio: true };
  available() {
    return isGeminiKey(geminiKey());
  }
  chat = (messages: ChatMessage[], options?: ChatOptions) => geminiChat(messages, (options ?? {}) as Record<string, unknown>);
  extractGrades = (input: OcrInput) => geminiOcrGrades(input);
  transcribe = (buffer: Buffer, mime: string) => geminiTranscribe(buffer, mime);
}

export class HuggingFaceProvider implements IAIProvider {
  readonly id = "huggingface";
  readonly label = "Hugging Face";
  readonly priority = 20;
  readonly capabilities = { chat: true, vision: true, audio: true };
  available() {
    return isHfToken(hfToken());
  }
  chat = (messages: ChatMessage[], options?: ChatOptions) => hfChat(messages, options ?? {});
  extractGrades = (input: OcrInput) => hfOcrGrades(input);
  transcribe = (buffer: Buffer, mime: string) => hfTranscribe(buffer, mime);
}

export class LocalProvider implements IAIProvider {
  readonly id = "local";
  readonly label = "Moteur local";
  readonly priority = 90;
  readonly capabilities = { chat: false, vision: false, audio: false };
  available() {
    return true; // toujours disponible (fallback déterministe hors ligne)
  }
  // Pas de chat/ocr/transcribe : le local ne fournit QUE l'analyse pédagogique
  // (réalisée via le moteur local intégré à generateAnalysis).
}

export type { OcrResult };
