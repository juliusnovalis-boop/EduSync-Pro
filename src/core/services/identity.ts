/**
 * Contrat d'identité/authentification (IIdentityService).
 * `src/lib/server/auth.ts` implémente DÉJÀ ce contrat (SHA-256, JWT HMAC, RBAC).
 */
export interface IdentityPayload {
  userId: string;
  role: string;
  kind?: string;
}

export interface IIdentityService {
  hashPassword(input: string): string;
  signToken(payload: IdentityPayload & Record<string, unknown>): string;
  verifyToken(token: string | null | undefined): IdentityPayload | null;
  /** Vérifie un jeton Bearer et (option) les rôles autorisés. */
  authorize(authHeader: string | null, roles?: string[]): { payload?: IdentityPayload; error?: string; status?: number };
}

/** Token DI pour le service d'identité par défaut. */
export const IDENTITY_TOKEN = "identity";
