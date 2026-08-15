import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserPlus, KeyRound, Copy, Check, Loader2, RefreshCcw, Ban, Trash2, CircleCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { Pill, SectionCard } from "../components/ui-kit";
import {
  Button, Dialog, DialogCloseButton, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
  Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { ROLE_LABELS, type AppRole, type AppUser } from "../lib/types";

type Credentials = { id: string; password: string };
const PAGE_SIZE = 10;

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Rôles créables par rôle de l'acteur (couche UI — le serveur reste la source de vérité,
 * cf. CREATABLE_ROLES dans src/lib/server/rbac.ts).
 */
const CREATABLE_BY_ROLE: Record<string, string[]> = {
  SUPER_ADMIN: ["ADMIN", "TEACHER", "STUDENT", "PARENT"],
  ADMIN: ["TEACHER"],
  TEACHER: ["STUDENT", "PARENT"],
};

/**
 * Gestion des accès — liste, recherche, filtres, pagination et création de comptes.
 * Toutes les données proviennent de /api/auth/users (vraie source). Les opérations
 * sensibles sont vérifiées côté serveur (RBAC). Aucune donnée mockée/hardcodée.
 */
export default function AccessPage() {
  const { session, can, authedFetch } = useAuth();
  const canManage = can("users.create"); // SUPER_ADMIN / ADMIN / TEACHER — pas STUDENT ni PARENT
  const isSuper = session?.isSuperAdmin ?? false;
  const canUpdateUsers = can("users.update");

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [fullNameInput, setFullNameInput] = useState("");
  const [roleInput, setRoleInput] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState<"id" | "password" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AppUser | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!canManage) return;
    setLoadingUsers(true);
    try {
      const res = await authedFetch("/api/auth/users");
      if (!res.ok) throw new Error("Chargement impossible");
      setUsers((await res.json()) as AppUser[]);
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setLoadingUsers(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  // Recherche + filtres (côté client sur la vraie liste serveur).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !(`${u.full_name} ${u.login_id} ${u.email ?? ""}`.toLowerCase().includes(q))) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  // Rôles créables : déterminés dynamiquement selon le rôle de l'acteur (couche UI).
  const creatable = CREATABLE_BY_ROLE[session?.role ?? ""] ?? [];
  const roleOptions: { value: AppRole; label: string }[] = creatable.map((r) => ({
    value: r as AppRole,
    label: ROLE_LABELS[r] ?? r,
  }));
  // Si le rôle sélectionné n'est plus créable, basculer sur le premier autorisé.
  const effectiveRoleInput = creatable.includes(roleInput) ? roleInput : (creatable[0] ?? "");

  async function createAccount() {
    if (!fullNameInput.trim()) return toast.error("Indiquez le nom complet");
    setCreating(true);
    try {
      const res = await authedFetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullNameInput, role: effectiveRoleInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de la création");
      setCredentials(data.credentials as Credentials);
      setCreateOpen(false);
      setFullNameInput("");
      setRoleInput("");
      toast.success("Compte créé — identifiants générés");
      void fetchUsers();
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  }

  async function regenerate(u: AppUser) {
    try {
      const res = await authedFetch("/api/auth/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, regenerate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec");
      if (data.credentials) setCredentials(data.credentials as Credentials);
      toast.success("Nouveau mot de passe généré");
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    }
  }

  async function toggleStatus(u: AppUser) {
    try {
      const res = await authedFetch("/api/auth/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, status: u.status === "ACTIVE" ? "suspendu" : "actif" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec");
      toast.success(u.status === "ACTIVE" ? "Compte suspendu" : "Compte réactivé");
      void fetchUsers();
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    }
  }

  async function deleteAccount() {
    if (!pendingDelete) return;
    try {
      const res = await authedFetch("/api/auth/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingDelete.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec");
      toast.success("Compte supprimé");
      setPendingDelete(null);
      void fetchUsers();
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    }
  }

  function copy(value: string, kind: "id" | "password") {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <SectionCard title="Votre session" description="Permissions de l'utilisateur connecté." icon={ShieldCheck}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {(session?.name ?? "UN").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <p className="font-bold">{session?.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">Identifiant : <span className="font-mono font-semibold">{session?.loginId ?? ""}</span></p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {session?.role && <Pill tone="primary">{ROLE_LABELS[session.role]}</Pill>}
          </div>
        </div>
      </SectionCard>

      {canManage ? (
        <SectionCard
          title="Comptes utilisateurs"
          description="Identifiants EDU-XXXXXXXX et mots de passe générés automatiquement (jamais en clair)."
          icon={KeyRound}
        >
          {/* Barre de recherche + filtres */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, identifiant ou e-mail…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Rôle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super administrateur</SelectItem>
                <SelectItem value="ADMIN">Administrateur</SelectItem>
                <SelectItem value="TEACHER">Enseignant</SelectItem>
                <SelectItem value="STUDENT">Élève</SelectItem>
                <SelectItem value="PARENT">Parent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="ACTIVE">Actif</SelectItem>
                <SelectItem value="SUSPENDED">Suspendu</SelectItem>
                <SelectItem value="DEMO">Démo</SelectItem>
                <SelectItem value="PENDING">En attente</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" title="Rafraîchir" onClick={() => void fetchUsers()}>
              <RefreshCcw className="size-4" />
            </Button>
            {roleOptions.length > 0 && (
              <Button onClick={() => setCreateOpen(true)}><UserPlus className="mr-2 size-4" /> Créer un compte</Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identifiant</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Aucun compte — ajustez la recherche ou créez le premier accès.</TableCell></TableRow>
                ) : (
                  pageRows.map((u) => {
                    const isAdminAccount = u.role === "ADMIN" || u.role === "SUPER_ADMIN";
                    const locked = !canUpdateUsers || (isAdminAccount && !isSuper);
                    return (
                      <TableRow key={u.id}>
                        <TableCell><span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold">{u.login_id}</span></TableCell>
                        <TableCell className="font-semibold">{u.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                        <TableCell><Pill tone={u.role === "ADMIN" || u.role === "SUPER_ADMIN" ? "info" : "muted"}>{ROLE_LABELS[u.role] ?? u.role}</Pill></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.school_name ?? (u.role === "SUPER_ADMIN" ? "Tous" : "—")}</TableCell>
                        <TableCell>
                          <Pill tone={u.status === "ACTIVE" ? "success" : u.status === "SUSPENDED" ? "danger" : "muted"}>
                            {u.status === "ACTIVE" ? "Actif" : u.status === "SUSPENDED" ? "Suspendu" : u.status === "DEMO" ? "Démo" : u.status === "PENDING" ? "En attente" : u.status}
                          </Pill>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(u.last_login_at)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(u.created_at)}</TableCell>
                        <TableCell className="text-right">
                          {!locked && (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" title="Réinitialiser le mot de passe" onClick={() => regenerate(u)}>
                                <RefreshCcw className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title={u.status === "ACTIVE" ? "Suspendre" : "Réactiver"} onClick={() => toggleStatus(u)}>
                                {u.status === "ACTIVE" ? <Ban className="size-4 text-warning-foreground" /> : <CircleCheck className="size-4 text-success" />}
                              </Button>
                              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setPendingDelete(u)}>
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{filtered.length} utilisateur(s) — page {safePage}/{totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Précédent</Button>
              <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Suivant</Button>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Votre accès" description="Informations de votre compte." icon={KeyRound}>
          <p className="text-sm text-muted-foreground">
            Votre identifiant de connexion est <span className="font-mono font-bold text-foreground">{session?.loginId}</span>.
            Pour toute modification de compte, contactez l'administration de l'établissement.
          </p>
        </SectionCard>
      )}

      {/* Création de compte */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <div>
          <DialogCloseButton onClick={() => setCreateOpen(false)} />
          <DialogHeader>
            <DialogTitle>Créer un compte utilisateur</DialogTitle>
            <DialogDescription>L'identifiant (EDU-XXXXXXXX) et le mot de passe sont générés automatiquement et uniques.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="acc-name">Nom complet</Label>
              <Input id="acc-name" value={fullNameInput} onChange={(e) => setFullNameInput(e.target.value)} placeholder="Ex : Marie ESSONO" />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={effectiveRoleInput} onValueChange={setRoleInput}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roleOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={createAccount} disabled={creating}>
              {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />} Générer le compte
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      {/* Identifiants générés (affichés une seule fois) */}
      <Dialog open={credentials !== null} onOpenChange={(v) => !v && setCredentials(null)}>
        <div>
          <DialogHeader>
            <DialogTitle>Identifiants générés</DialogTitle>
            <DialogDescription>Communiquez-les à l'utilisateur — le mot de passe ne sera plus affiché ensuite.</DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identifiant</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-extrabold">{credentials.id}</span>
                  <Button variant="outline" size="sm" onClick={() => copy(credentials.id, "id")}>
                    {copied === "id" ? <Check className="mr-1 size-3.5 text-success" /> : <Copy className="mr-1 size-3.5" />} Copier
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mot de passe</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-extrabold">{credentials.password}</span>
                  <Button variant="outline" size="sm" onClick={() => copy(credentials.password, "password")}>
                    {copied === "password" ? <Check className="mr-1 size-3.5 text-success" /> : <Copy className="mr-1 size-3.5" />} Copier
                  </Button>
                </div>
              </div>
              <p className="rounded-lg bg-warning/20 p-3 text-xs text-warning-foreground">
                Notez ces identifiants maintenant : par sécurité, le mot de passe n'est pas conservé en clair.
              </p>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button onClick={() => setCredentials(null)}>J'ai noté les identifiants</Button>
          </DialogFooter>
        </div>
      </Dialog>

      {/* Suppression */}
      <Dialog open={pendingDelete !== null} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <div>
          <DialogHeader>
            <DialogTitle>Supprimer ce compte ?</DialogTitle>
            <DialogDescription>
              Le compte de <strong>{pendingDelete?.full_name}</strong> ({pendingDelete?.login_id}) ne pourra plus se connecter. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Annuler</Button>
            <Button variant="destructive" onClick={deleteAccount}>Supprimer</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}