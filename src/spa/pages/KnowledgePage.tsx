import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, Search, Star, Library, Filter, X, ExternalLink,
  Globe2, ShieldAlert, Loader2, Lock, Info, Plus, Pencil, Archive,
  Building2, Download, BookMarked, Sparkles, Wrench, SlidersHorizontal,
} from "lucide-react";
import { PageHeader } from "../components/ui-kit";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";
import {
  GEO_LEVELS, SUBJECTS, SCHOOL_LEVELS,
  RIGHTS_DISPLAY, ACCESS_DISPLAY, SOURCE_TYPE_LABELS, RESOURCE_TYPES,
  type AccessMode, type RightsStatus, type KnowledgeSourceType, type KnowledgeScope,
} from "../lib/knowledge-sources";
import KnowledgeBookViewer from "../components/KnowledgeBookViewer";

/** Fiche Knowledge unifiée (référence globale OU ressource établissement). */
type KnowledgeItem = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  publication_year: number | null;
  edition: string | null;
  subject: string | null;
  level: string | null;
  class: string | null;
  language: string;
  country: string | null;
  geo_level: string;
  description: string | null;
  cover_url: string | null;
  resource_type: string | null;
  source: string;
  source_id: string;
  source_type: string;
  source_url: string | null;
  external_id: string | null;
  license: string | null;
  rights_status: string;
  access_status: string;
  scope: string;
  school_id: string | null;
  status: string | null;
  file_url: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  origin: string; // "reference" | "local"
};

const FAV_KEY = "edusync_knowledge_favorites";
const HIST_KEY = "edusync_knowledge_history";

function loadList(key: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(key) ?? "[]") as string[]; return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveList(key: string, v: string[]) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

const RIGHTS_META: Record<string, { label: string; icon: typeof Lock; cls: string; warn?: boolean }> = {
  OPEN_LICENSE: { label: "Licence ouverte", icon: Lock, cls: "text-blue-600" },
  INSTITUTION_LICENSE: { label: "Licence établissement", icon: Building2, cls: "text-violet-600" },
  PUBLIC_DOMAIN: { label: "Domaine public", icon: Globe2, cls: "text-emerald-600" },
  AUTHORIZED: { label: "Autorisé", icon: Lock, cls: "text-blue-600" },
  UNKNOWN: { label: "Droits à vérifier", icon: ShieldAlert, cls: "text-amber-600", warn: true },
  RESTRICTED: { label: "Droits restreints", icon: ShieldAlert, cls: "text-red-600", warn: true },
};

const ACCESS_META: Record<string, string> = {
  global: "Accès global",
  establishment: "Établissement",
  private: "Privé",
  external: "Source externe",
  READ_IN_EDUSYNC: "Lire dans EduSync",
  DOWNLOAD_IN_EDUSYNC: "Télécharger dans EduSync",
  OPEN_EXTERNAL_SOURCE: "Ouvrir la source externe",
  REQUEST_ACCESS: "Demander l'accès",
  UNAVAILABLE: "Indisponible",
};

/** Niveaux pour filtres. */
const LEVEL_OPTIONS = ["Maternelle", "Primaire", "Collège", "Lycée", "Université", "Formation professionnelle"];

/** Pays/catégories prioritaires. */
const COUNTRY_OPTIONS = ["Gabon", "Cameroun", "Congo", "Sénégal", "Côte d'Ivoire", "Afrique", "France", "International"];

/** Libellés des statuts de droits pour le formulaire. */
const RIGHTS_FORM = [
  { value: "OPEN_LICENSE", label: "Licence ouverte" },
  { value: "INSTITUTION_LICENSE", label: "Licence établissement" },
  { value: "PUBLIC_DOMAIN", label: "Domaine public" },
  { value: "AUTHORIZED", label: "Autorisé" },
  { value: "UNKNOWN", label: "Droits à vérifier" },
  { value: "RESTRICTED", label: "Droits restreints" },
];

/** Modes d'accès pour le formulaire. */
const ACCESS_FORM = [
  { value: "READ_IN_EDUSYNC", label: "Lire dans EduSync" },
  { value: "DOWNLOAD_IN_EDUSYNC", label: "Télécharger dans EduSync" },
  { value: "OPEN_EXTERNAL_SOURCE", label: "Ouvrir la source externe" },
  { value: "REQUEST_ACCESS", label: "Demander l'accès" },
  { value: "UNAVAILABLE", label: "Indisponible" },
];

/** Portée pour le formulaire. */
const SCOPE_FORM = [
  { value: "ESTABLISHMENT", label: "Établissement (mon école)" },
  { value: "PRIVATE", label: "Privé" },
  { value: "GLOBAL", label: "Global" },
];

/** Sources externes documentées (fournisseurs). */
const EXTERNAL_PROVIDERS = [
  { label: "Open Library", url: "https://openlibrary.org", rights: "OPEN_LICENSE" as RightsStatus },
  { label: "Internet Archive", url: "https://archive.org", rights: "UNKNOWN" as RightsStatus },
  { label: "Gallica / BnF", url: "https://gallica.bnf.fr", rights: "PUBLIC_DOMAIN" as RightsStatus },
  { label: "Médiathèque Educmad", url: "https://www.educmad.mg", rights: "UNKNOWN" as RightsStatus },
  { label: "Fomesoutra", url: "https://www.fomesoutra.com", rights: "UNKNOWN" as RightsStatus },
  { label: "FreeBookSpot", url: "https://www.freebookspot.com", rights: "UNKNOWN" as RightsStatus },
  { label: "eBookRadar", url: "https://www.ebookradar.org", rights: "UNKNOWN" as RightsStatus },
  { label: "WeLib", url: "https://welib.fr", rights: "UNKNOWN" as RightsStatus },
  { label: "Ebook Searcher", url: "https://ebook-searcher.com", rights: "UNKNOWN" as RightsStatus },
  { label: "Anna's Archive", url: "https://annas-archive.org", rights: "UNKNOWN" as RightsStatus },
  { label: "Library Genesis", url: "https://libgen.is", rights: "UNKNOWN" as RightsStatus },
] as const;
/** Normalise défensivement un item reçu de l'API : garantit que `authors` est
 *  toujours un tableau de chaînes et que `language` est une chaîne non vide,
 *  afin qu'aucune ressource incomplète ne fasse crasher le rendu. */
function normalizeKnowledgeItem(item: Partial<KnowledgeItem> | null | undefined): KnowledgeItem {
  const base: KnowledgeItem = {
    id: "", title: "", subtitle: null, authors: [], isbn: null, publisher: null,
    publication_year: null, edition: null, subject: null, level: null, class: null,
    language: "fr", country: null, geo_level: "international", description: null,
    cover_url: null, resource_type: "other", source: "—", source_id: "", source_type: "EXTERNAL_LIBRARY",
    source_url: null, external_id: null, license: null, rights_status: "UNKNOWN",
    access_status: "UNAVAILABLE", scope: "GLOBAL", school_id: null, status: "active",
    file_url: null, created_by: null, created_at: null, updated_at: null, origin: "reference",
  };
  if (!item || typeof item !== "object") return base;
  const authors = Array.isArray(item.authors)
    ? item.authors.filter((a): a is string => typeof a === "string")
    : typeof item.authors === "string"
      ? [item.authors]
      : [];
  return {
    ...base,
    ...item,
    id: String(item.id ?? base.id),
    title: String(item.title ?? base.title),
    subtitle: item.subtitle ?? null,
    authors,
    language: typeof item.language === "string" && item.language.length > 0 ? item.language : "fr",
    geo_level: item.geo_level === "gabon" || item.geo_level === "afrique" || item.geo_level === "international"
      ? item.geo_level
      : "international",
    resource_type: item.resource_type ?? "other",
    source: typeof item.source === "string" ? item.source : "—",
    source_id: typeof item.source_id === "string" ? item.source_id : base.source_id,
    source_type: item.source_type ?? "EXTERNAL_LIBRARY",
    rights_status: item.rights_status ?? "UNKNOWN",
    access_status: item.access_status ?? "UNAVAILABLE",
    scope: item.scope ?? "GLOBAL",
    status: item.status ?? "active",
    origin: item.origin === "local" ? "local" : "reference",
  };
}

export default function KnowledgePage() {
  const { can, session } = useAuth();
  const canManage = can("knowledge.manage");

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [language, setLanguage] = useState("");
  const [access, setAccess] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [geo, setGeo] = useState("");
  const [rights, setRights] = useState("");
  const [activeSection, setActiveSection] = useState<string>("all");

  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<KnowledgeItem | null>(null);
  const [viewing, setViewing] = useState<KnowledgeItem | null>(null);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [favorites, setFavorites] = useState<string[]>(() => loadList(FAV_KEY));
  const [history, setHistory] = useState<string[]>(() => loadList(HIST_KEY));

  // Debounce : déclenche la recherche ~300 ms après la frappe.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (debounced.trim()) params.set("q", debounced.trim());
      if (subject) params.set("subject", subject);
      if (level) params.set("level", level);
      if (language) params.set("language", language);
      if (access) params.set("access", access);
      if (sourceType) params.set("source_type", sourceType);
      if (geo) params.set("geo", geo);
      if (rights) params.set("rights", rights);
      const res = await fetch("/api/knowledge?" + params.toString());
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Erreur serveur");
      const data = (await res.json()) as { items?: KnowledgeItem[] };
      // Normalisation défensive : la page ne doit jamais crasher si une ressource
      // est incomplète ou si l'API renvoie une réponse sans `items`.
      const rawItems = Array.isArray(data.items) ? data.items : [];
      setItems(rawItems.map((item) => normalizeKnowledgeItem(item)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [debounced, subject, level, language, access, sourceType, geo, rights]);

  useEffect(() => { load(); }, [load]);

  const reload = useCallback(async () => { await load(); }, [load]);

  // Regroupements par catégorie.
  const schoolItems = useMemo(() => items.filter((i) => i.origin === "local" && i.scope === "ESTABLISHMENT"), [items]);
  const freeItems = useMemo(
    () => items.filter((i) => i.rights_status === "OPEN_LICENSE" || i.rights_status === "PUBLIC_DOMAIN" || i.rights_status === "INSTITUTION_LICENSE" || i.rights_status === "AUTHORIZED"),
    [items],
  );
  const gabonItems = useMemo(() => items.filter((i) => i.geo_level === "gabon" || i.country === "Gabon"), [items]);
  const afriqueItems = useMemo(() => items.filter((i) => i.geo_level === "afrique"), [items]);
  const intlItems = useMemo(() => items.filter((i) => i.geo_level === "international"), [items]);
  const externalItems = useMemo(
    () => items.filter((i) => i.source_type === "EXTERNAL_SEARCH" || i.source_type === "EXTERNAL_LIBRARY" || i.access_status === "external"),
    [items],
  );

  const openItem = useCallback((item: KnowledgeItem) => {
    setSelected(item);
    setHistory((prev) => {
      const next = [item.id, ...prev.filter((x) => x !== item.id)].slice(0, 40);
      saveList(HIST_KEY, next);
      return next;
    });
    // Consigne serveur silencieuse.
    fetch("/api/knowledge/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource_id: item.id, action: item.access_status === "external" ? "EXTERNAL_OPEN" : "OPEN" }),
    }).catch(() => {});
  }, []);

  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveList(FAV_KEY, next);
      return next;
    });
  }, []);

  const startRead = useCallback((item: KnowledgeItem) => {
    if (item.access_status === "OPEN_EXTERNAL_SOURCE" && item.source_url) {
      window.open(item.source_url, "_blank");
      return;
    }
    setViewing(item);
  }, []);

  const clearFilters = useCallback(() => {
    setSubject(""); setLevel(""); setLanguage(""); setAccess("");
    setSourceType(""); setGeo(""); setRights("");
  }, []);

  const activeFilters = [subject, level, language, access, sourceType, geo, rights].filter(Boolean).length;

  const sections: { id: string; title: string; items: KnowledgeItem[]; hint?: string }[] = [
    { id: "school", title: "🏫 Ma bibliothèque", items: schoolItems, hint: "Ressources de mon établissement" },
    { id: "free", title: "🔓 Ressources libres", items: freeItems, hint: "Licences ouvertes / domaine public" },
    { id: "gabon", title: "🇬🇦 Gabon", items: gabonItems, hint: "Système éducatif gabonais" },
    { id: "afrique", title: "🌍 Afrique", items: afriqueItems, hint: "Afrique centrale & francophone" },
    { id: "intl", title: "🌐 International", items: intlItems, hint: "Ressources internationales" },
    { id: "external", title: "🌐 Sources externes", items: externalItems, hint: "Catalogue de référence — droits à vérifier" },
  ];

  const visibleSections = activeSection === "all" ? sections : sections.filter((s) => s.id === activeSection);
  const favItems = favorites.map((id) => items.find((i) => i.id === id)).filter((x): x is KnowledgeItem => Boolean(x));
  const historyItems = history.map((id) => items.find((i) => i.id === id)).filter((x): x is KnowledgeItem => Boolean(x)).slice(0, 12);
return (
    <div className="space-y-6">
      <PageHeader
        title="📚 EduSync Knowledge"
        subtitle="Bibliothèque numérique scolaire — Gabon, Afrique, International"
        action={
          <div className="flex items-center gap-2 text-sm">
            {canManage && (
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                <Plus className="size-4" /> Ajouter un manuel
              </button>
            )}
            <span className="rounded-full bg-primary/12 px-3 py-1 font-semibold text-primary">{items.length} ressources</span>
          </div>
        }
      />

      {/* Recherche + filtres */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Rechercher un manuel, un auteur, un ISBN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border bg-card pl-10 pr-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition", showFilters ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
          >
            <SlidersHorizontal className="size-4" /> Filtres
            {activeFilters > 0 && <span className="rounded-full bg-primary-foreground/20 px-1.5 text-xs">{activeFilters}</span>}
          </button>
        </div>
        {showFilters && <FiltersPanel subject={subject} setSubject={setSubject} level={level} setLevel={setLevel} language={language} setLanguage={setLanguage} geo={geo} setGeo={setGeo} rights={rights} setRights={setRights} access={access} setAccess={setAccess} sourceType={sourceType} setSourceType={setSourceType} activeFilters={activeFilters} clearFilters={clearFilters} />}

        {/* Onglets de sections */}
        <div className="flex flex-wrap gap-2">
          <SectionTab active={activeSection === "all"} onClick={() => setActiveSection("all")} label="Tout" />
          {sections.map((s) => (
            <SectionTab key={s.id} active={activeSection === s.id} onClick={() => setActiveSection(s.id)} label={s.title} />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
{/* Favoris & récents */}
      {(favItems.length > 0 || historyItems.length > 0) && activeSection === "all" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {historyItems.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><ClockIcon /> Récemment consultés</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {historyItems.map((item) => <BookCard key={item.id} item={item} isFav={favorites.includes(item.id)} onOpen={openItem} onFav={toggleFav} compact />)}
              </div>
            </div>
          )}
          {favItems.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Star className="size-4 text-amber-500" /> Mes favoris</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {favItems.map((item) => <BookCard key={item.id} item={item} isFav onOpen={openItem} onFav={toggleFav} compact />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Chargement…</div>
      ) : (
        <div className="space-y-8">
          {visibleSections.map((s) => (
            <div key={s.id}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-extrabold">{s.title}</h2>
                {s.hint && <span className="text-xs text-muted-foreground">{s.hint}</span>}
              </div>
              {s.items.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aucune ressource dans cette catégorie.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {s.items.map((item) => (
                    <BookCard key={item.id} item={item} isFav={favorites.includes(item.id)} onOpen={openItem} onFav={toggleFav} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sources externes — fournisseurs */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><ExternalLink className="size-4" /> Fournisseurs de sources externes</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          EduSync ne copie, ne télécharge ni n'héberge le contenu de ces plateformes. Les métadonnées sont référencées ; les droits et conditions d'accès applicables font autorité.
        </p>
        <div className="flex flex-wrap gap-2">
          {EXTERNAL_PROVIDERS.map((p) => (
            <a key={p.label} href={p.url} target="_blank" rel="noopener noreferrer"
              title={p.rights === "UNKNOWN" ? "Droits à vérifier" : `Statut : ${p.rights}`}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium hover:bg-accent/70">
              {p.rights === "UNKNOWN" ? <ShieldAlert className="size-3 text-amber-500" /> : <Globe2 className="size-3 text-emerald-500" />}
              {p.label}
            </a>
          ))}
        </div>
      </div>

      {/* Modals */}
      {selected && (
        <ItemDetail
          item={selected}
          onClose={() => setSelected(null)}
          isFav={favorites.includes(selected.id)}
          onFav={() => toggleFav(selected.id)}
          canManage={canManage}
          onEdit={canManage ? () => { setEditing(selected); setSelected(null); setShowForm(true); } : undefined}
          onRead={selected.origin === "local" && (selected.access_status === "READ_IN_EDUSYNC" || selected.access_status === "DOWNLOAD_IN_EDUSYNC") ? () => startRead(selected) : undefined}
          onArchive={canManage && selected.origin === "local" ? async () => {
            const res = await fetch(`/api/knowledge?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
            if (res.ok) { setSelected(null); await reload(); } else {
              const d = await res.json().catch(() => ({}));
              window.alert((d as { error?: string }).error ?? "Impossible d'archiver.");
            }
          } : undefined}
        />
      )}

      {viewing && <KnowledgeBookViewer resourceId={viewing.id} title={viewing.title} fileUrl={viewing.file_url} canDownload={viewing.access_status === "DOWNLOAD_IN_EDUSYNC"} onClose={() => setViewing(null)} />}

      {showForm && canManage && (
        <ResourceForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => { setShowForm(false); setEditing(null); await reload(); }}
        />
      )}
    </div>
  );
}
function RightsBadge({ rights }: { rights: string }) {
  const meta = RIGHTS_META[rights] ?? RIGHTS_META.UNKNOWN;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", meta.cls)}>
      <meta.icon className="size-3" /> {meta.label}
    </span>
  );
}

function Cover({ item }: { item: KnowledgeItem }) {
  if (item.cover_url) {
    return <img src={item.cover_url} alt={item.title} className="size-16 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <BookOpen className="size-7" />
    </span>
  );
}

function BookCard({ item, isFav, onOpen, onFav, compact }: {
  item: KnowledgeItem; isFav: boolean; onOpen: (i: KnowledgeItem) => void; onFav: (id: string) => void; compact?: boolean;
}) {
  const isExternal = item.source_type === "EXTERNAL_SEARCH" || item.access_status === "external";
  return (
    <div className={cn("group relative rounded-xl border bg-card p-3 transition-shadow hover:shadow-md", compact && "p-2")}>
      <button onClick={(e) => { e.stopPropagation(); onFav(item.id); }} className="absolute right-2 top-2 z-10" aria-label="Favori">
        <Star className={cn("size-4", isFav ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
      </button>
      <button onClick={() => onOpen(item)} className="flex w-full items-start gap-3 text-left">
        <Cover item={item} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">{item.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {item.authors.length ? item.authors.join(", ") : item.source}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {item.subject && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium">{item.subject}</span>}
            {item.level && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium">{item.level}</span>}
            {item.class && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium">{item.class}</span>}
            {item.publication_year && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium">{item.publication_year}</span>}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
            <RightsBadge rights={item.rights_status} />
            {isExternal && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ExternalLink className="size-3" /> Source externe</span>}
          </span>
        </span>
      </button>
    </div>
  );
}
/* ---------------------- Sous-composants ---------------------- */

function ClockIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

function SectionTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
        active ? "bg-primary text-primary-foreground" : "bg-accent text-foreground hover:bg-accent/70",
      )}
    >
      {label}
    </button>
  );
}

function FiltersPanel(props: {
  subject: string; setSubject: (v: string) => void;
  level: string; setLevel: (v: string) => void;
  language: string; setLanguage: (v: string) => void;
  geo: string; setGeo: (v: string) => void;
  rights: string; setRights: (v: string) => void;
  access: string; setAccess: (v: string) => void;
  sourceType: string; setSourceType: (v: string) => void;
  activeFilters: number; clearFilters: () => void;
}) {
  const { subject, setSubject, level, setLevel, language, setLanguage, geo, setGeo, rights, setRights, access, setAccess, sourceType, setSourceType, activeFilters, clearFilters } = props;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold">Filtres</h3>
        {activeFilters > 0 && <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">Effacer les filtres</button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect label="Géographie" value={geo} onChange={setGeo} options={Object.entries(GEO_LEVELS).map(([id, g]) => ({ value: id, label: g.label }))} />
        <FilterSelect label="Matière" value={subject} onChange={setSubject} options={SUBJECTS.map((s) => ({ value: s, label: s }))} />
        <FilterSelect label="Niveau" value={level} onChange={setLevel} options={LEVEL_OPTIONS.map((l) => ({ value: l, label: l }))} />
        <FilterSelect label="Langue" value={language} onChange={setLanguage} options={[{ value: "fr", label: "Français" }, { value: "en", label: "Anglais" }, { value: "es", label: "Espagnol" }]} />
        <FilterSelect label="Type de source" value={sourceType} onChange={setSourceType} options={[
          { value: "LOCAL_LIBRARY", label: "Établissement" },
          { value: "INSTITUTIONAL", label: "Institutionnel" },
          { value: "OPEN_RESOURCE", label: "Ressource libre" },
          { value: "EXTERNAL_LIBRARY", label: "Bibliothèque externe" },
          { value: "EXTERNAL_SEARCH", label: "Catalogue de recherche" },
        ]} />
        <FilterSelect label="Mode d'accès" value={access} onChange={setAccess} options={[
          { value: "READ_IN_EDUSYNC", label: "Lire dans EduSync" },
          { value: "DOWNLOAD_IN_EDUSYNC", label: "Télécharger" },
          { value: "OPEN_EXTERNAL_SOURCE", label: "Source externe" },
          { value: "REQUEST_ACCESS", label: "Demander l'accès" },
        ]} />
        <FilterSelect label="Droits" value={rights} onChange={setRights} options={[
          { value: "OPEN_LICENSE", label: "Licence ouverte" },
          { value: "INSTITUTION_LICENSE", label: "Licence établissement" },
          { value: "PUBLIC_DOMAIN", label: "Domaine public" },
          { value: "UNKNOWN", label: "Droits à vérifier" },
          { value: "RESTRICTED", label: "Restreint" },
        ]} />
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
        <option value="">Tous</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function ItemDetail({ item, onClose, isFav, onFav, canManage, onEdit, onRead, onArchive }: {
  item: KnowledgeItem; onClose: () => void; isFav: boolean; onFav: () => void;
  canManage: boolean; onEdit?: () => void; onRead?: () => void; onArchive?: () => Promise<void>;
}) {
  const Right = RIGHTS_META[item.rights_status] ?? RIGHTS_META.UNKNOWN;
  const isExternal = item.source_type === "EXTERNAL_SEARCH" || item.source_type === "EXTERNAL_LIBRARY" || item.access_status === "external";
  const isLocalReadable = item.origin === "local" && !!onRead;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Cover item={item} />
            <div>
              <h2 className="text-xl font-bold leading-tight">{item.title}</h2>
              {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
              <p className="text-sm text-muted-foreground">
                {item.authors.length ? item.authors.join(", ") : item.source}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onFav} aria-label="Favori">
              <Star className={cn("size-5", isFav ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
            </button>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent" aria-label="Fermer"><X className="size-5" /></button>
          </div>
        </div>

        {item.description && <p className="mb-4 text-sm text-foreground/90">{item.description}</p>}

        <dl className="mb-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Meta label="Matière" value={item.subject ?? "—"} />
          <Meta label="Niveau" value={item.level ?? "—"} />
          <Meta label="Classe" value={item.class ?? "—"} />
          <Meta label="Langue" value={item.language.toUpperCase()} />
          <Meta label="Pays" value={item.country ?? "—"} />
          <Meta label="Année" value={item.publication_year ? String(item.publication_year) : "—"} />
          <Meta label="Éditeur" value={item.publisher ?? "—"} />
          <Meta label="ISBN" value={item.isbn ?? "—"} />
          <Meta label="Édition" value={item.edition ?? "—"} />
          <Meta label="Auteurs" value={item.authors.length ? item.authors.join(", ") : "—"} />
          <Meta label="Licence" value={item.license ?? "—"} />
          <Meta label="Source" value={item.source} />
        </dl>

        <div className={cn("mb-2 flex items-center gap-2 rounded-lg bg-accent p-3 text-sm font-medium", Right.cls)}>
          <Right.icon className="size-4" /> {Right.label}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Mode d'accès : {ACCESS_META[item.access_status] ?? item.access_status}</p>

        {isExternal && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-semibold"><Info className="size-4" /> 🌐 Source externe</div>
            <p className="mt-1 text-xs">
              Cette ressource provient d'un catalogue externe. EduSync ne copie ni n'héberge le contenu.
              {item.rights_status === "UNKNOWN" ? " Droits à vérifier — ne supposez pas qu'elle est libre." : ""}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isLocalReadable && (
            <button onClick={onRead} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <BookOpen className="size-4" /> Lire le manuel
            </button>
          )}
          {item.access_status === "DOWNLOAD_IN_EDUSYNC" && item.origin === "local" && onRead && (
            <button onClick={onRead} className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold">
              <Download className="size-4" /> Télécharger
            </button>
          )}
          {item.source_url && isExternal && (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <ExternalLink className="size-4" /> Ouvrir la source
            </a>
          )}
          {canManage && onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent">
              <Pencil className="size-4" /> Modifier
            </button>
          )}
          {canManage && onArchive && (
            <button onClick={() => { if (window.confirm("Archiver cette ressource ?")) onArchive?.(); }} className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
              <Archive className="size-4" /> Archiver
            </button>
          )}
          {!isLocalReadable && !item.source_url && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4" /> Accès non direct via EduSync.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
function ResourceForm({ initial, onClose, onSaved }: {
  initial: KnowledgeItem | null; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [authors, setAuthors] = useState(initial?.authors.join(", ") ?? "");
  const [isbn, setIsbn] = useState(initial?.isbn ?? "");
  const [publisher, setPublisher] = useState(initial?.publisher ?? "");
  const [year, setYear] = useState(initial?.publication_year ? String(initial.publication_year) : "");
  const [edition, setEdition] = useState(initial?.edition ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [level, setLevel] = useState(initial?.level ?? "");
  const [classLevel, setClassLevel] = useState(initial?.class ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "fr");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? "");
  const [resourceType, setResourceType] = useState(initial?.resource_type ?? "MANUEL");
  const [fileUrl, setFileUrl] = useState(initial?.file_url ?? "");
  const [license, setLicense] = useState(initial?.license ?? "");
  const [rights, setRights] = useState<RightsStatus>((initial?.rights_status as RightsStatus) ?? "OPEN_LICENSE");
  const [access, setAccess] = useState<AccessMode>((initial?.access_status as AccessMode) ?? "READ_IN_EDUSYNC");
  const [scope, setScope] = useState<KnowledgeScope>((initial?.scope as KnowledgeScope) ?? "ESTABLISHMENT");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErr("Le titre est requis."); return; }
    setSaving(true); setErr("");
    const payload: Record<string, unknown> = {
      title: title.trim(),
      subtitle: subtitle || null,
      authors: authors.split(",").map((a) => a.trim()).filter(Boolean),
      isbn: isbn || null,
      publisher: publisher || null,
      publication_year: year ? parseInt(year) : null,
      edition: edition || null,
      subject: subject || null,
      level: level || null,
      class_level: classLevel || null,
      language: language || "fr",
      country: country || null,
      description: description || null,
      cover_url: coverUrl || null,
      resource_type: resourceType,
      file_url: fileUrl || null,
      license: license || null,
      rights_status: rights,
      access_mode: access,
      scope,
    };
    if (initial?.id) payload.id = initial.id;
    try {
      const res = await fetch("/api/knowledge", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur d'enregistrement.");
      await onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{initial ? "Modifier la ressource" : "Ajouter un manuel / document"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-accent" aria-label="Fermer"><X className="size-5" /></button>
        </div>
        {err && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
<div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Titre *" full><input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Mathématiques 6e" /></FormField>
          <FormField label="Sous-titre"><input className={inp} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></FormField>
          <FormField label="Auteur(s) (séparés par virgules)"><input className={inp} value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Ex. Dupont, Martin" /></FormField>
          <FormField label="ISBN"><input className={inp} value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978-..." /></FormField>
          <FormField label="Éditeur"><input className={inp} value={publisher} onChange={(e) => setPublisher(e.target.value)} /></FormField>
          <FormField label="Année"><input className={inp} type="number" value={year} onChange={(e) => setYear(e.target.value)} /></FormField>
          <FormField label="Édition"><input className={inp} value={edition} onChange={(e) => setEdition(e.target.value)} /></FormField>
          <FormField label="Matière">
            <select className={inp} value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">—</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Niveau">
            <select className={inp} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">—</option>
              {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </FormField>
          <FormField label="Classe">
            <select className={inp} value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
              <option value="">—</option>
              {SCHOOL_LEVELS.flatMap((l) => l.cycles.map((c) => c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Langue">
            <select className={inp} value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="fr">Français</option><option value="en">Anglais</option><option value="es">Espagnol</option>
            </select>
          </FormField>
          <FormField label="Pays">
            <select className={inp} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">—</option>
              {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Type de ressource">
            <select className={inp} value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
              {RESOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Statut des droits">
            <select className={inp} value={rights} onChange={(e) => setRights(e.target.value as RightsStatus)}>
              {RIGHTS_FORM.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </FormField>
          <FormField label="Mode d'accès">
            <select className={inp} value={access} onChange={(e) => setAccess(e.target.value as AccessMode)}>
              {ACCESS_FORM.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </FormField>
          <FormField label="Visibilité (portée)">
            <select className={inp} value={scope} onChange={(e) => setScope(e.target.value as KnowledgeScope)}>
              {SCOPE_FORM.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FormField>
          <FormField label="Licence"><input className={inp} value={license} onChange={(e) => setLicense(e.target.value)} placeholder="Ex. Licence établissement" /></FormField>
          <FormField label="URL de la couverture"><input className={inp} value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} /></FormField>
          <FormField label="URL du fichier (PDF)"><input className={inp} value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="Pour une ressource READ/DOWNLOAD dans EduSync" /></FormField>
          <FormField label="Description" full>
            <textarea className={cn(inp, "min-h-20")} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">Annuler</button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <SaveIcon />} Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

function FormField({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(full && "sm:col-span-2")}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SaveIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" />
    </svg>
  );
}
