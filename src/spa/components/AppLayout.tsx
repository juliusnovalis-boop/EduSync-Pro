import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { Bell, GraduationCap, LogOut, Menu, Search, X } from "lucide-react";
import { AppSidebar, NAV_ITEMS } from "./AppSidebar";
import { Button, Input } from "./ui";
import { useAuth } from "../lib/auth";
import { ROLE_LABELS } from "../lib/types";

export default function AppLayout() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate("/auth", { replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm">Chargement d'EduSync Pro…</p>
        </div>
      </div>
    );
  }

  const current = NAV_ITEMS.find((item) => item.url === location.pathname);
  const currentTitle = current?.title ?? "Espace";
  const displayName = session.name || "Utilisateur";
  const roleLabel = ROLE_LABELS[session.role] ?? "Utilisateur";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* ---------- Sidebar desktop (16rem / w-64) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <AppSidebar />
      </aside>

      {/* ---------- Sidebar mobile ---------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-xl">
            <button
              className="absolute right-3 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-5" />
            </button>
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* ---------- Contenu principal ---------- */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Bandeau démo — EXCLUSIF à l'environnement de démonstration (jamais en officiel) */}
        {session.environment === "demo" && (
          <div className="bg-warning px-4 py-1.5 text-center text-xs font-semibold text-warning-foreground">
            Mode démo — bac à sable isolé. Les données affichées proviennent de l'environnement de démonstration, séparé de la version officielle.
          </div>
        )}

        {/* ---------- En-tête sticky (72px) ---------- */}
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="rounded-full lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </Button>

          {/* Fil d'Ariane */}
          <nav className="hidden items-center gap-2 text-sm md:flex">
            <span className="text-muted-foreground">EduSync Pro</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold capitalize">{currentTitle}</span>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/* Recherche */}
            <div className="relative hidden lg:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher élève, enseignant..."
                className="w-72 rounded-full bg-muted pl-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate("/students");
                }}
              />
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>

            {/* Utilisateur */}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold leading-tight">{displayName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Link
              to="/access"
              className="gradient-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              {displayName.slice(0, 1).toUpperCase()}
            </Link>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Déconnexion" onClick={() => { signOut(); navigate("/auth", { replace: true }); }}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        {/* ---------- Zone de contenu ---------- */}
        <main className="flex-1 px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>

      <span className="hidden"><GraduationCap className="size-4" /></span>
    </div>
  );
}
