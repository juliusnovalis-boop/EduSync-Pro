import { useEffect, useState } from "react";
import { Database, RotateCcw, Save, Settings as SettingsIcon, Sparkles, UserCog, Cpu, Lock, Calendar, Plus, Archive, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard } from "../components/ui-kit";
import AiUsageCard from "../components/AiUsageCard";
import AiProviderCatalogCard from "../components/AiProviderCatalogCard";
import AiHealthCard from "../components/AiHealthCard";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui";
import { useAuth } from "../lib/auth";
import { ROLE_LABELS, type AcademicYear } from "../lib/types";
import { apiFetch } from "../lib/api";

type AiLength = "standard" | "detaille" | "exhaustif";
type AiProviderChoice = "auto" | "gemini" | "openrouter" | "huggingface" | "ollama" | "tokenin" | "local";

const LENGTH_OPTIONS: { value: AiLength; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "~4 000 tokens · rapport concis" },
  { value: "detaille", label: "Détaillé", hint: "~8 000 tokens · rapport approfondi" },
  { value: "exhaustif", label: "Exhaustif", hint: "~16 000 tokens · rapport très long" },
];

/** Types du catalogue IA (sous-ensemble de /api/ai/catalog) — aucune clé exposée. */
type CatalogModel = {
  provider: string;
  model: string;
  available: boolean;
  freeStatus: "FREE" | "FREE_LIMITED" | "PAID" | "UNKNOWN" | "BLOCKED";
  pricingStatus: string;
  capabilities: string[];
  reason: string;
};
type CatalogSection = {
  provider: string;
  label: string;
  configured: boolean;
  available: boolean;
  freeStatus: string;
  summary: string;
  models: CatalogModel[];
};

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  gemini: [
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite — rapide & économique" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash — équilibré" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro — qualité maximale" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  huggingface: [
    { value: "meta-llama/Llama-3.1-8B-Instruct:novita", label: "Llama 3.1 8B Instruct (texte)" },
    { value: "deepseek-ai/DeepSeek-V4-Pro:novita", label: "DeepSeek V4 Pro (texte)" },
    { value: "moonshotai/Kimi-K3:together", label: "Kimi-K3 (texte + vision)" },
    { value: "Qwen/Qwen3.6-27B:featherless-ai", label: "Qwen 3.6 27B (vision)" },
  ],
  // Fallbacks statiques — utilisés UNIQUEMENT si le catalogue dynamique
  // (/api/ai/catalog) n'est pas encore chargé. La source de vérité reste le
  // catalogue réel côté serveur (FREE ONLY appliqué au modèle).
  openrouter: [
    { value: "openrouter/free", label: "openrouter/free" },
  ],
  ollama: [],
  local: [],
};

export default function SettingsPage() {
  const { session, signOut, authHeaders, authedFetch, updateEmail, can } = useAuth();
  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [adminEmail, setAdminEmail] = useState(session?.email ?? "");

  // Année académique
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [ayLoading, setAyLoading] = useState(true);
  const [ayName, setAyName] = useState("");
  const [ayStart, setAyStart] = useState("");
  const [ayEnd, setAyEnd] = useState("");
  const [savingAy, setSavingAy] = useState(false);
  const canManageYear = can("academic_year.manage");
  const [aiLabel, setAiLabel] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiProvider, setAiProvider] = useState<AiProviderChoice>("auto");
  const [aiModel, setAiModel] = useState("");
  const [aiModelCustom, setAiModelCustom] = useState("");
  const [aiLength, setAiLength] = useState<AiLength>("exhaustif");
  const [savingAi, setSavingAi] = useState(false);
  // Catalogue IA réel (modèles TOKENIN FREE / FREE ONLY) + config persistée brute.
  const [catalog, setCatalog] = useState<CatalogSection[] | null>(null);
  const [persistedProvider, setPersistedProvider] = useState<AiProviderChoice>("auto");
  const [persistedLength, setPersistedLength] = useState<AiLength>("exhaustif");
  const [persistedModel, setPersistedModel] = useState("");
  const catalogLoading = catalog === null;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const isSuperAdmin = session?.isSuperAdmin ?? false;
  const isAdmin = session?.isAdmin ?? false;

  useEffect(() => {
    apiFetch("/api/ai")
      .then((r) => r.json())
      .then((d: { aiEnabled: boolean; label: string }) => setAiLabel(d.aiEnabled ? d.label : null))
      .catch(() => setAiLabel(null))
      .finally(() => setAiLoading(false));
    // Catalogue IA réel (modèles TOKENIN FREE via AIProviderCatalog, dynamique).
    apiFetch("/api/ai/catalog", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { providers?: CatalogSection[] } | null) => setCatalog(d?.providers ?? null))
      .catch(() => setCatalog(null));
    apiFetch("/api/settings")
      .then((r) => r.json())
      .then((d: { provider: AiProviderChoice; model: string; length: AiLength }) => {
        setPersistedProvider(d.provider ?? "auto");
        setPersistedLength(d.length ?? "exhaustif");
        setPersistedModel(d.model ?? "");
      })
      .catch(() => {});
    authedFetch("/api/academic-years")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: AcademicYear[]) => setYears(Array.isArray(d) ? d : []))
      .catch(() => setYears([]))
      .finally(() => setAyLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resolveProvider(p: AiProviderChoice): string {
    if (p === "auto") return aiLabel ? (aiLabel.includes("Gemini") ? "gemini" : "huggingface") : "local";
    return p;
  }
/**
   * Options de modèles du sélecteur.
   * - TOKEN FREE IA : liste DYNAMIQUE réelle issue de /api/ai/catalog, restreinte
   *   aux modèles gratuits confirmés (freeStatus === "FREE") — jamais codée en dur,
   *   jamais payante sous FREE ONLY. IDs TOKENIN conservés à l'identique.
   * - Autres providers : liste statique historique (comportement inchangé).
   */
  function modelOptionsFor(p: string): { value: string; label: string }[] {
    // Fournisseurs "catalogue" : modèles DYNAMIQUES réels issus de /api/ai/catalog.
    // Sous FREE ONLY, on ne propose que les modèles confirmés gratuits disponibles.
    if (p === "tokenin" || p === "openrouter" || p === "ollama") {
      const section = catalog?.find((x) => x.provider === p);
      if (section && section.models.length > 0) {
        return section.models
          .filter((m) => m.available && (m.freeStatus === "FREE" || m.freeStatus === "FREE_LIMITED"))
          .map((m) => ({ value: m.model, label: m.model }));
      }
      // Fallback statique sûr si le catalogue n'est pas (encore) chargé.
      return MODEL_OPTIONS[p] ?? [];
    }
    return MODEL_OPTIONS[p] ?? [];
  }

  // Applique la configuration persistée (provider/modèle/longueur) dès que le
  // catalogue est disponible, afin qu'un modèle TOKENIN restaure correctement
  // sa sélection après rechargement.
  useEffect(() => {
    setAiProvider(persistedProvider);
    setAiLength(persistedLength);
    const known = modelOptionsFor(resolveProvider(persistedProvider));
    if (persistedModel && known.some((m) => m.value === persistedModel)) {
      setAiModel(persistedModel);
      setAiModelCustom("");
    } else if (persistedModel) {
      setAiModel("__custom__");
      setAiModelCustom(persistedModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedProvider, persistedLength, catalog]);

  async function saveAiConfig() {
    setSavingAi(true);
    try {
      const model = aiModel === "__custom__" ? aiModelCustom : aiModel;
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ provider: aiProvider, model, length: aiLength }),
      });
      if (!res.ok) throw new Error("Échec de l'enregistrement");
      toast.success("Configuration IA enregistrée");
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setSavingAi(false);
    }
  }

  async function changeAdminPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pwd = newPassword.trim();
    const email = adminEmail.trim();
    const emailChanged = email.length > 0 && email !== (session?.email ?? "");
    if (!pwd && !emailChanged) {
      return toast.error("Saisissez un nouveau mot de passe ou un nouvel e-mail");
    }
    if (pwd && (pwd.length < 6 || pwd.length > 32)) {
      return toast.error("Le nouveau mot de passe doit contenir entre 6 et 32 caractères");
    }
    setSavingPwd(true);
    try {
      const res = await authedFetch("/api/auth/admin-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: pwd || undefined, email: emailChanged ? email : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Échec de la mise à jour");
      if (data.email) updateEmail(data.email);
      toast.success("Identifiants mis à jour", { description: "La modification sera effective à la prochaine connexion." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error("Erreur", { description: (err as Error).message });
    } finally {
      setSavingPwd(false);
    }
  }

  async function refreshYears() {
    try {
      const r = await authedFetch("/api/academic-years");
      if (r.ok) setYears((await r.json()) as AcademicYear[]);
    } catch {
      /* ignore */
    }
  }

  async function createYear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ayName.trim()) return toast.error("Indiquez le nom de l'année (ex. 2026–2027).");
    setSavingAy(true);
    try {
      const res = await authedFetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ayName, start_date: ayStart || undefined, end_date: ayEnd || undefined, status: "DRAFT" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Échec de la création");
      toast.success("Année académique créée");
      setAyName(""); setAyStart(""); setAyEnd("");
      void refreshYears();
    } catch (err) {
      toast.error("Erreur", { description: (err as Error).message });
    } finally {
      setSavingAy(false);
    }
  }

  async function activateYear(id: string) {
    try {
      const res = await authedFetch("/api/academic-years", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "ACTIVE" }),
      });
      if (!res.ok) throw new Error("Échec de l'activation");
      toast.success("Année activée — les autres sont archivées");
      void refreshYears();
    } catch (err) {
      toast.error("Erreur", { description: (err as Error).message });
    }
  }

  async function archiveYear(id: string) {
    try {
      const res = await authedFetch("/api/academic-years", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "ARCHIVED" }),
      });
      if (!res.ok) throw new Error("Échec de l'archivage");
      toast.success("Année archivée");
      void refreshYears();
    } catch (err) {
      toast.error("Erreur", { description: (err as Error).message });
    }
  }

  async function resetData() {
    setResetting(true);
    try {
      const res = await authedFetch("/api/seed?reset=1", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (res.status === 401) return;
      if (!res.ok) throw new Error("Échec de la réinitialisation");
      await queryClient.invalidateQueries();
      toast.success("Données de démonstration réinitialisées");
    } catch (err) {
      toast.error("Erreur", { description: (err as Error).message });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <PageHeader title="Paramètres" subtitle="Profil, informations applicatives et données." />

      <SectionCard title="Profil" description="Votre compte utilisateur." icon={UserCog}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nom</dt>
            <dd className="mt-1 font-bold">{session?.name ?? "—"}</dd>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identifiant</dt>
            <dd className="mt-1 font-mono font-bold">{session?.loginId ?? "—"}</dd>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rôle</dt>
            <dd className="mt-1"><Pill tone="primary">{session?.role ? ROLE_LABELS[session.role] : "—"}</Pill></dd>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Établissement</dt>
            <dd className="mt-1 font-bold">{session?.establishment?.name ?? (session?.isSuperAdmin ? "Aucun (admin. de l'app)" : "—")}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <Button variant="outline" onClick={() => signOut()}>Se déconnecter</Button>
        </div>
      </SectionCard>

      <SectionCard title="Application" description="Informations sur la plateforme EduSync Pro." icon={SettingsIcon}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Version</dt>
            <dd className="mt-1 font-bold">1.0.0</dd>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stack</dt>
            <dd className="mt-1 font-bold">Next.js · React · PostgreSQL</dd>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Année scolaire</dt>
            <dd className="mt-1 font-bold">2026 — 2027</dd>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Établissement actif</dt>
            <dd className="mt-1 font-bold">{session?.establishment?.name ?? (session?.isSuperAdmin ? "Tous (super admin)" : "—")}</dd>
          </div>
        </dl>
      </SectionCard>

      {isSuperAdmin && (
        <SectionCard title="Configuration IA — Super Admin" description="Choisissez le fournisseur, le modèle et le niveau de détail des rapports." icon={Cpu}>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              {aiLoading ? (
                <span className="text-sm text-muted-foreground">Vérification…</span>
              ) : aiLabel ? (
                <Pill tone="success"><Sparkles className="mr-1 size-3" /> {aiLabel} détecté</Pill>
              ) : (
                <Pill tone="muted">Moteur local (aucune clé)</Pill>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Diagnostic des clés API</p>
              <div className="mt-3 space-y-2">
                {[
                  { id: "gemini", label: "Google Gemini", key: "GEMINI_API_KEY" },
                  { id: "openrouter", label: "OpenRouter", key: "OPENROUTER_API_KEY" },
                  { id: "huggingface", label: "Hugging Face", key: "HF_TOKEN" },
                  { id: "ollama", label: "Ollama", key: "OLLAMA_API_KEY" },
                  { id: "tokenin", label: "TOKEN FREE IA", key: "TOKEN_API_KEY" },
                ].map((p) => {
                  const section = catalog?.find((x) => x.provider === p.id);
                  const configured = section?.configured ?? false;
                  const hasFree = (section?.models ?? []).some((m) => m.freeStatus === "FREE" || m.freeStatus === "FREE_LIMITED");
                  // Statut affiché sans jamais exposer la valeur de la clé.
                  let pill: { tone: "success" | "warning" | "muted" | "danger"; text: string };
                  if (!configured) {
                    pill = { tone: "muted", text: "Absent" };
                  } else if (p.id === "tokenin") {
                    pill = hasFree
                      ? { tone: "success", text: "Configuré · Free autorisé" }
                      : { tone: "warning", text: "Aucun modèle gratuit détecté" };
                  } else if (p.id === "huggingface") {
                    pill = hasFree ? { tone: "success", text: "Configuré" } : { tone: "muted", text: "Non requis" };
                  } else if (p.id === "ollama") {
                    pill = hasFree
                      ? { tone: "success", text: "Configuré · Free autorisé" }
                      : { tone: "warning", text: "Aucun modèle gratuit vérifié" };
                  } else {
                    pill = { tone: "success", text: "Configuré" };
                  }
                  return (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span>{p.label} — <code className="text-xs text-muted-foreground">{p.key}</code></span>
                      <Pill tone={pill.tone}>{pill.text}</Pill>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fournisseur IA</Label>
              <Select value={aiProvider} onValueChange={(v) => { setAiProvider(v as AiProviderChoice); setAiModel(""); setAiModelCustom(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatique (recommandé)</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="huggingface">Hugging Face</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                  <SelectItem value="local">Local (hors ligne)</SelectItem>
                  <SelectItem value="tokenin">TOKEN FREE IA</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">« Automatique » utilise la meilleure clé disponible (Gemini → Hugging Face → local).</p>
            </div>

            {aiProvider !== "local" && (
              <div className="space-y-2">
                <Label>Modèle</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger><SelectValue placeholder="Modèle par défaut du fournisseur" /></SelectTrigger>
                  <SelectContent>
                    {(modelOptionsFor(resolveProvider(aiProvider)) ?? []).map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">Modèle personnalisé…</SelectItem>
                  </SelectContent>
                </Select>
                {aiModel === "__custom__" && (
                  <Input placeholder="ex: gemini-2.5-pro" value={aiModelCustom} onChange={(e) => setAiModelCustom(e.target.value)} className="mt-2" />
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Niveau de détail (longueur du rapport)</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {LENGTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAiLength(opt.value)}
                    className={`rounded-xl border p-4 text-left transition ${aiLength === opt.value ? "border-primary bg-accent/50 ring-1 ring-ring" : "border-border hover:bg-accent/30"}`}
                  >
                    <span className="block text-sm font-bold">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={saveAiConfig} disabled={savingAi}>
                <Save className="mr-2 size-4" /> {savingAi ? "Enregistrement…" : "Enregistrer la configuration"}
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      {can("audit.read") && <AiUsageCard />}
      {can("audit.read") && <AiProviderCatalogCard />}

      {session?.role === "SUPER_ADMIN" && <AiHealthCard />}

      {isSuperAdmin && (
        <SectionCard title="Sécurité — Super Admin" description="Modifiez votre mot de passe et votre e-mail de connexion." icon={Lock}>
          <form onSubmit={changeAdminPassword} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pwd-current">Mot de passe actuel</Label>
              <Input id="pwd-current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd-next">Nouveau mot de passe</Label>
              <Input id="pwd-next" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="Laisser vide pour ne pas changer" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-email">E-mail du compte</Label>
              <Input id="admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@edusync.ga" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={savingPwd}>
                <Lock className="mr-2 size-4" /> {savingPwd ? "Mise à jour…" : "Mettre à jour les identifiants"}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Année académique" description="Gérez les années scolaires. Une seule année est ACTIVE à la fois ; les autres restent dans l'historique." icon={Calendar}>
        <div className="space-y-4">
          {ayLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : years.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune année académique.</p>
          ) : (
            <div className="space-y-2">
              {years.map((y) => (
                <div key={y.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                  <div>
                    <p className="flex items-center gap-2 font-bold">
                      {y.name}
                      {y.status === "ACTIVE" && <Pill tone="success">Active</Pill>}
                      {y.status === "ARCHIVED" && <Pill tone="muted">Archivée</Pill>}
                      {y.status === "DRAFT" && <Pill tone="info">Brouillon</Pill>}
                    </p>
                    <p className="text-xs text-muted-foreground">{y.start_date ?? "—"} → {y.end_date ?? "—"}</p>
                  </div>
                  {canManageYear && (
                    <div className="flex gap-2">
                      {y.status !== "ACTIVE" && (
                        <Button size="sm" variant="outline" onClick={() => activateYear(y.id)}><CheckCircle2 className="mr-1 size-4" /> Activer</Button>
                      )}
                      {y.status === "ACTIVE" && (
                        <Button size="sm" variant="outline" onClick={() => archiveYear(y.id)}><Archive className="mr-1 size-4" /> Archiver</Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManageYear && (
            <form onSubmit={createYear} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor="ay-name">Nom</Label>
                <Input id="ay-name" value={ayName} onChange={(e) => setAyName(e.target.value)} placeholder="2026–2027" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ay-start">Début</Label>
                <Input id="ay-start" type="date" value={ayStart} onChange={(e) => setAyStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ay-end">Fin</Label>
                <Input id="ay-end" type="date" value={ayEnd} onChange={(e) => setAyEnd(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={savingAy}><Plus className="mr-1 size-4" /> Créer</Button>
              </div>
            </form>
          )}
        </div>
      </SectionCard>

      {isSuperAdmin && (
        <SectionCard title="Données de démonstration" description="Réinitialise toutes les tables avec le jeu de données de démonstration (Gabon)." icon={Database}>
          <p className="text-sm text-muted-foreground">
            Cette action efface puis régénère élèves, enseignants, classes, matières, notes, présences, paiements et emplois du temps.
          </p>
          <Button variant="destructive" className="mt-4" onClick={resetData} disabled={resetting}>
            <RotateCcw className="mr-2 size-4" /> {resetting ? "Réinitialisation…" : "Réinitialiser les données"}
          </Button>
        </SectionCard>
      )}
    </div>
  );
}
