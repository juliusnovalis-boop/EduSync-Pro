import { useCallback, useEffect, useState } from "react";
import { Boxes, RefreshCw } from "lucide-react";
import { SectionCard } from "./ui-kit";
import { Button } from "./ui";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

/**
 * PROVIDERS IA — affichage dynamique du catalogue unifié (AIProviderCatalog).
 * Données : /api/ai/catalog (serveur uniquement). AUCUNE clé n'est exposée :
 * uniquement statuts FREE / FREE_LIMITED / PAID / UNKNOWN / BLOCKED et modèles.
 */

type CatalogModel = {
  provider: string;
  model: string;
  available: boolean;
  freeStatus: "FREE" | "FREE_LIMITED" | "PAID" | "UNKNOWN" | "BLOCKED";
  pricingStatus: string;
  capabilities: string[];
  reason: string;
};

type CatalogData = {
  checkedAt: string;
  providers: Array<{
    provider: string;
    label: string;
    configured: boolean;
    available: boolean;
    freeStatus: string;
    summary: string;
    models: CatalogModel[];
  }>;
  huggingFaceCredit: { limit: number | null; remaining: number | null; known: boolean };
  ollamaPlan: string;
};

const STATUS_TONE: Record<string, string> = {
  FREE: "text-emerald-600 dark:text-emerald-400",
  FREE_LIMITED: "text-amber-600 dark:text-amber-400",
  PAID: "text-destructive",
  UNKNOWN: "text-muted-foreground",
  BLOCKED: "text-destructive",
};

export default function AiProviderCatalogCard() {
  const { authHeaders, can } = useAuth();
  const [data, setData] = useState<CatalogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((refresh = false) => {
    setLoading(true);
    setError(null);
    apiFetch(`/api/ai/catalog${refresh ? "?refresh=1" : ""}`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: CatalogData) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { if (can("audit.read")) load(); }, [load, can]);

  if (!can("audit.read")) return null;

  return (
    <SectionCard title="Providers IA" description="Catalogue dynamique — modèles réellement disponibles (gratuits uniquement)." icon={Boxes}>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
        </Button>
        {data && <span className="text-xs text-muted-foreground">Mis à jour : {new Date(data.checkedAt).toLocaleString()}</span>}
      </div>

      {loading && !data && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        {(data?.providers ?? []).map((p) => (
          <div key={p.provider} className="rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">{p.label}</p>
              <span className={`text-sm font-semibold ${STATUS_TONE[p.freeStatus] ?? ""}`}>{p.summary}</span>
            </div>
            {p.models.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aucun modèle disponible.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {/* Garde-fou : déduplication par identité provider+model avant rendu
                    (une même identité ne doit jamais produire deux enfants React). */}
                {[...new Map(p.models.map((m) => [`${m.provider}:${m.model}`, m] as const)).values()].map((m) => (
                  <li key={`${m.provider}:${m.model}`} className="text-xs">
                    <span className="font-mono">{m.model}</span>
                    {" "}
                    <span className={STATUS_TONE[m.freeStatus] ?? ""}>({m.freeStatus})</span>
                    {m.capabilities.length > 0 && (
                      <span className="ml-2 text-muted-foreground">[{m.capabilities.join(", ")}]</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
