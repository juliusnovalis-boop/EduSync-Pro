import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { SectionCard, Pill } from "./ui-kit";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import type { Establishment } from "../lib/types";

/**
 * CONSOMMATION IA — carte de consultation READ-ONLY (SettingsPage).
 * Données : /api/ai/usage (aiGuard AUDIT_READ + AIQuotaManager + ai_usage_logs).
 * SUPER_ADMIN : sélecteurs établissement + environnement. ADMIN : verrouillé côté serveur.
 */
type Period = "today" | "7d" | "30d";

type QuotaPart = { used: number; limit: number; remaining: number };
type UsageData = {
  window: { period: string; since: string };
  scope: { schoolId: string; environment: string };
  summary: { minute: QuotaPart; day: QuotaPart };
  totals: { requests: number; success: number; errors: number; quotaExceeded: number };
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
};

const PERIOD_LABELS: Record<Period, string> = { today: "Aujourd'hui", "7d": "7 jours", "30d": "30 jours" };

export default function AiUsageCard() {
  const { session, authHeaders, can } = useAuth();
  const isSuperAdmin = session?.role === "SUPER_ADMIN";
  const [period, setPeriod] = useState<Period>("today");
  const [schoolId, setSchoolId] = useState<string>("");
  const [environment, setEnvironment] = useState<string>("all");
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;
    apiFetch("/api/data/establishments", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setEstablishments(Array.isArray(rows) ? rows : []))
      .catch(() => setEstablishments([]));
  }, [isSuperAdmin, authHeaders]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ period });
    if (isSuperAdmin && schoolId && schoolId !== "all") params.set("schoolId", schoolId);
    if (isSuperAdmin && environment !== "all") params.set("environment", environment);
    apiFetch(`/api/ai/usage?${params.toString()}`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: UsageData) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period, schoolId, environment, isSuperAdmin, authHeaders]);

  useEffect(() => { load(); }, [load]);
  // Rafraîchit automatiquement chaque minute (compteur minute).
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!can("audit.read")) return null;

  const row = (label: string, value: string | number) => (
    <div key={label} className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
  const quotaRow = (label: string, q: QuotaPart) => (
    <div key={label} className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{q.used} / {q.limit} <span className="text-xs font-normal text-muted-foreground">(reste {q.remaining})</span></span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${q.remaining === 0 ? "bg-destructive" : q.remaining <= q.limit * 0.2 ? "bg-warning" : "bg-primary"}`}
          style={{ width: `${Math.min(100, Math.round((q.used / Math.max(1, q.limit)) * 100))}%` }}
        />
      </div>
    </div>
  );

  return (
    <SectionCard title="Consommation IA" description="Quotas et utilisation réelle du service IA." icon={Activity}>
      <div className="grid gap-4 sm:grid-cols-3">
        {isSuperAdmin && (
          <>
            <div className="space-y-2">
              <Label>Établissement</Label>
              <Select value={schoolId || "all"} onValueChange={setSchoolId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les établissements</SelectItem>
                  {establishments.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Environnement</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="production">Officiel</SelectItem>
                  <SelectItem value="demo">Démo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label>Période</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading && !data && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            {quotaRow("Quota minute", data.summary.minute)}
            {quotaRow("Quota journalier", data.summary.day)}
            <div className="rounded-xl border p-3">
              <div className="mb-1"><Pill tone="info">Période : {PERIOD_LABELS[data.window.period as Period] ?? period}</Pill></div>
              {row("Requêtes IA", data.totals.requests)}
              {row("Réussies", data.totals.success)}
              {row("Erreurs", data.totals.errors)}
              {row("Quotas dépassés", data.totals.quotaExceeded)}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border p-3">
              <p className="mb-2 text-sm font-bold">Par fournisseur</p>
              {Object.entries(data.byProvider).length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée sur la période.</p>}
              {Object.entries(data.byProvider).map(([k, v]) => row(k, v))}
            </div>
            <div className="rounded-xl border p-3">
              <p className="mb-2 text-sm font-bold">Par modèle</p>
              {Object.entries(data.byModel).length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée sur la période.</p>}
              {Object.entries(data.byModel).map(([k, v]) => row(k, v))}
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Rafraîchir</Button>
      </div>
    </SectionCard>
  );
}
