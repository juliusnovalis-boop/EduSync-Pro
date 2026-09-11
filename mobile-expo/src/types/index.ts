/**
 * Types métier partagés (copie contrôlée depuis src/spa/lib/types.ts).
 * Seuls les éléments nécessaires au MVP mobile sont repris ici.
 */

export type AppEnvironment = "production" | "demo";

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DIRECTOR"
  | "TEACHER"
  | "STUDENT"
  | "PARENT"
  | string;

export interface SessionInfo {
  userId: string;
  loginId: string;
  name: string;
  email: string | null;
  role: Role;
  status: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  permissions: string[];
  environment: AppEnvironment;
}

export interface LoginResponse {
  ok: boolean;
  token?: string;
  session?: SessionInfo;
  error?: string;
}
