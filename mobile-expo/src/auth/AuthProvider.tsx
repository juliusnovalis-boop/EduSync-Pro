import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SessionInfo } from "../types";
import { authService } from "./authService";
import { setUnauthorizedHandler } from "../api/client";

type AuthState = {
  session: SessionInfo | null;
  loading: boolean; // restauration en cours (splash)
  signingIn: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  // Restauration de session au démarrage de l'app.
  useEffect(() => {
    authService
      .restore()
      .then(setSession)
      .finally(() => setLoading(false));
  }, []);

  // Déconnexion automatique sur 401 (token absent/expiré/révoqué).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null);
      authService.logout().catch(() => {});
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      signingIn,
      signIn: async (identifier, password) => {
        setSigningIn(true);
        try {
          const s = await authService.login(identifier, password);
          setSession(s);
        } finally {
          setSigningIn(false);
        }
      },
      signOut: async () => {
        await authService.logout();
        setSession(null);
      },
    }),
    [session, loading, signingIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
