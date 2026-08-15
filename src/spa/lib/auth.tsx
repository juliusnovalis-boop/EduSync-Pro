import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { AppRole, Establishment } from "./types";
import type { AppEnvironment } from "./environment";
import { currentEnvironment } from "./environment";
import { apiFetch } from "./api";

/**
 * Session applicative EduSync Pro (frontend).
 *
 * ⭐ Le JETON de session n'est JAMAIS stocké côté navigateur : il réside dans un
 * cookie HttpOnly posé par le serveur (inaccessible au JavaScript). L'état de
 * session affiché ici (rôle, nom…) est une simple copie UI rafraîchie depuis
 * /api/auth/me (source de vérité serveur). Les sessions DEMO et OFFICIEL sont
 * stockées sous des clés distinctes.
 */
export type SessionInfo = {
  userId: string;
  loginId: string;
  name: string;
  email: string | null;
  role: AppRole;
  status: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  mustChangePassword: boolean;
  permissions: string[];
  establishment: Establishment | null;
  environment: AppEnvironment;
};

/** Clé de stockage ISOLÉE par environnement (état UI uniquement — pas de jeton). */
function storageKey(): string {
  return `edusync.${currentEnvironment()}.session`;
}

export const DEFAULT_ESTABLISHMENT: Establishment = {
  id: "est-libreville",
  name: "Lycée National Léon Mba",
  code: "LNLM",
  province_id: "g1",
  city: "Libreville",
  address: "Avenue du Colonel Parant",
  phone: "+241 01 44 23 10",
  email: "contact@leonmba.ga",
  type: "mixte",
  director_name: "M. OBIANG ESSONO",
  school_year: "2025-2026",
  status: "actif",
  created_at: new Date().toISOString(),
};

type SessionPayload = {
  userId: string;
  loginId: string;
  name: string;
  email?: string | null;
  role: AppRole;
  status?: string;
  schoolId?: string | null;
  isSuperAdmin?: boolean;
  mustChangePassword?: boolean;
  permissions?: string[];
  environment?: AppEnvironment;
};

type AuthState = {
  session: SessionInfo | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  /** Inscription DÉMO uniquement. */
  register: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  authHeaders: () => Record<string, string>;
  /** fetch() utilisant le cookie de session (HttpOnly). Déconnecte sur 401. */
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  can: (permission: string) => boolean;
  completePasswordChange: () => void;
  updateEmail: (email: string) => void;
};

const AuthContext = createContext<AuthState | null>(null);

function buildSession(s: SessionPayload): SessionInfo {
  const role = s.role;
  const permissions = s.permissions ?? [];
  const isSuper = s.isSuperAdmin ?? role === "SUPER_ADMIN";
  const environment = s.environment ?? currentEnvironment();
  return {
    userId: s.userId,
    loginId: s.loginId,
    name: s.name,
    email: s.email ?? null,
    role,
    status: s.status ?? "ACTIVE",
    schoolId: s.schoolId ?? null,
    isSuperAdmin: isSuper,
    isAdmin: isSuper || role === "ADMIN" || role === "admin",
    isStaff: role !== "STUDENT" && role !== "PARENT" && role !== "eleve" && role !== "parent",
    mustChangePassword: s.mustChangePassword ?? false,
    permissions,
    establishment: isSuper ? null : DEFAULT_ESTABLISHMENT,
    environment,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Restauration AUTORITATIVE depuis le serveur (le cookie HttpOnly valide la session).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; session?: SessionPayload };
          if (data.ok && data.session) {
            const next = buildSession(data.session);
            setSession(next);
            try {
              localStorage.setItem(storageKey(), JSON.stringify(next));
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* hors ligne / indispo */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(next: SessionInfo) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setSession(next);
  }

  async function signIn(identifier: string, password: string) {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok: boolean; session?: SessionPayload; error?: string };
    if (!res.ok || !data.ok || !data.session) {
      throw new Error(data.error ?? "Identifiants incorrects.");
    }
    // Le serveur pose le cookie HttpOnly ; on ne stocke aucun jeton ici.
    persist(buildSession(data.session));
  }

  async function register(fullName: string, email: string, password: string) {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok: boolean; session?: SessionPayload; error?: string };
    if (!res.ok || !data.ok || !data.session) {
      throw new Error(data.error ?? "Inscription impossible.");
    }
    persist(buildSession(data.session));
  }

  async function signOut() {
    // Révocation serveur + suppression du cookie, puis nettoyage local.
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(storageKey());
    } catch {
      /* ignore */
    }
    setSession(null);
  }

  function authHeaders(): Record<string, string> {
    // Aucun jeton à injecter : l'authentification repose sur le cookie HttpOnly.
    return {};
  }

  async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const res = await apiFetch(input, { ...init, headers: { ...(init.headers ?? {}) } });
    if (res.status === 401) {
      await signOut();
      toast.error("Session expirée", { description: "Votre session n'est plus valide. Veuillez vous reconnecter." });
      if (typeof window !== "undefined") {
        window.location.href = currentEnvironment() === "demo" ? "/demo/auth" : "/auth";
      }
    }
    return res;
  }

  function can(permission: string): boolean {
    return (session?.permissions ?? []).includes(permission);
  }

  function completePasswordChange() {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, mustChangePassword: false };
      try {
        localStorage.setItem(storageKey(), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function updateEmail(email: string) {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, email };
      try {
        localStorage.setItem(storageKey(), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <AuthContext.Provider
      value={{ session, loading, signIn, register, signOut, authHeaders, authedFetch, can, completePasswordChange, updateEmail }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
