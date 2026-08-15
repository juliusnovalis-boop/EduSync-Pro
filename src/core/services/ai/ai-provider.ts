/**
 * Contrat d'un fournisseur IA (IAIProvider).
 * Un nouveau fournisseur (OpenAI, Claude, Mistral…) = une nouvelle implémentation
 * enregistrée comme plugin — AUCUNE modification du Core ou des routes.
 */

export interface ChatMessage {
  role: string;
  content: unknown;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  [key: string]: unknown;
}

export interface OcrStudentRef {
  id: string;
  name: string;
}

export interface OcrInput {
  imageDataUrl: string;
  students: OcrStudentRef[];
}

export type OcrResult = Array<{ studentId: string; value: number }>;

export interface ProviderCapabilities {
  chat: boolean;
  vision: boolean;
  audio: boolean;
}

export interface IAIProvider {
  /** Identifiant stable (ex. "gemini", "huggingface", "local"). */
  readonly id: string;
  /** Libellé humain (ex. "Google Gemini"). */
  readonly label: string;
  /** Priorité (plus bas = essayé en premier). */
  readonly priority: number;
  /** Capacités supportées par ce fournisseur. */
  readonly capabilities: ProviderCapabilities;
  /** Clés/secrets configurés et disponibles ? */
  available(): boolean;

  /** Chat textuel (synthèse, résumé…). Indéfini si non supporté. */
  chat?(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  /** OCR de notes (vision). Indéfini si non supporté. */
  extractGrades?(input: OcrInput): Promise<OcrResult>;
  /** Transcription audio (speech-to-text). Indéfini si non supporté. */
  transcribe?(buffer: Buffer, mimeType: string): Promise<string>;
}

/** Paramètres de l'analyse pédagogique (compatibles avec generateAnalysis). */
export interface AnalysisParams {
  term: string;
  termLabel: string;
  students: Array<Record<string, unknown>>;
  subjects: Array<Record<string, unknown>>;
  grades: Array<{ value: number; max_value: number; term: string; subject_id: string; student_id: string }>;
  attendance: Array<{ status: string }>;
  payments: Array<{ amount: number; status: string }>;
  focus?: string;
}
