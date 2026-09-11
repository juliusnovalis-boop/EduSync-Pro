import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, KeyRound, Loader2, User, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label } from "../components/ui";
import { useAuth } from "../lib/auth";
import { isDemoEnv } from "../lib/environment";

/**
 * Page de connexion unique et masquée :
 * un seul formulaire « Identifiant + Mot de passe » pour tous les profils.
 *
 * En ENVIRONNEMENT DÉMO (/demo), un formulaire d'INSCRIPTION est également
 * disponible : il crée un compte EXCLUSIVEMENT dans le bac à sable démo.
 * En production, seule la connexion est proposée (comptes délivrés par l'administration).
 */
export default function AuthPage() {
  const navigate = useNavigate();
  const { session, loading, signIn, register } = useAuth();
  const demo = isDemoEnv();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loadingForm, setLoadingForm] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate("/dashboard", { replace: true });
  }, [loading, session, navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = identifier.trim();
    if (!id) return toast.error("Saisissez votre identifiant");
    if (!password) return toast.error("Saisissez votre mot de passe");
    setLoadingForm(true);
    try {
      await signIn(id, password);
      toast.success("Bienvenue sur EduSync Pro");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error("Connexion impossible", { description: (err as Error).message });
    } finally {
      setLoadingForm(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (fullName.trim().length < 2) return toast.error("Saisissez votre nom complet");
    if (password.length < 4) return toast.error("Mot de passe : 4 caractères minimum");
    setLoadingForm(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      toast.success("Compte démo créé", { description: "Bienvenue dans le bac à sable de démonstration." });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error("Inscription impossible", { description: (err as Error).message });
    } finally {
      setLoadingForm(false);
    }
  }

  function fillDemo() {
    setMode("login");
    setIdentifier("EDU-DEMO2026");
    setPassword("demo2026");
    toast.info("Compte démo rempli", { description: "Cliquez sur « Se connecter »." });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="gradient-primary relative hidden flex-col justify-between p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
            <GraduationCap className="size-6" />
          </span>
          <span>
            <span className="block text-lg font-extrabold">EduSync Pro</span>
            <span className="block text-[10px] font-semibold tracking-[0.2em] opacity-80">SCHOOL MANAGER</span>
          </span>
        </div>
        <div>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">
            Toute votre école, synchronisée en un seul endroit.
          </h2>
          <p className="mt-4 max-w-md text-sm opacity-85">
            Élèves, enseignants, notes, présences, bulletins, paiements et analyses — une plateforme unique pour piloter
            votre établissement au quotidien.
          </p>
        </div>
        <p className="text-xs opacity-70">
          {demo ? "Environnement de démonstration — données isolées · " : ""}Année scolaire 2026 — 2027   ·   v1.0.0
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="gradient-primary flex size-9 items-center justify-center rounded-xl text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-extrabold">EduSync Pro</span>
          </div>

          {demo && (
            <div className="mb-4 inline-flex rounded-lg border border-warning/40 bg-warning/10 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-md px-3 py-1.5 transition ${mode === "login" ? "bg-warning text-warning-foreground" : "text-muted-foreground"}`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded-md px-3 py-1.5 transition ${mode === "register" ? "bg-warning text-warning-foreground" : "text-muted-foreground"}`}
              >
                Créer un compte démo
              </button>
            </div>
          )}

          {(!demo || mode === "login") && (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight">Espace de gestion</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Saisissez l'identifiant et le mot de passe qui vous ont été attribués.
              </p>

              <form onSubmit={handleSignIn} className="surface-card mt-8 space-y-4 p-6">
                <div className="space-y-2">
                  <Label htmlFor="signin-id">Identifiant</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signin-id"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                      placeholder="Votre identifiant"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Mot de passe</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loadingForm}>
                  {loadingForm && <Loader2 className="mr-2 size-4 animate-spin" />} Se connecter
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Vos identifiants sont délivrés par l'administration de l'établissement.
                </p>
              </form>

              {demo && (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Premier accès ?{" "}
                  <button type="button" onClick={fillDemo} className="font-semibold text-primary hover:underline">
                    Utiliser le compte démo
                  </button>
                </p>
              )}
            </>
          )}

          {demo && mode === "register" && (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight">Créer un compte démo</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Créez un compte dans le bac à sable de démonstration (données isolées de la version officielle).
              </p>

              <form onSubmit={handleRegister} className="surface-card mt-8 space-y-4 p-6">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Nom complet</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Prénom et nom"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">E-mail (optionnel)</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.ga"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Mot de passe</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Au moins 4 caractères"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loadingForm}>
                  {loadingForm ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />} Créer mon compte démo
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Ce compte n'existera que dans l'environnement de démonstration.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
