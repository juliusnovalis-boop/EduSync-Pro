import { useCallback, useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { SectionCard, Pill } from "./ui-kit";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

/**
 * AI HEALTH — carte SUPER_ADMIN (SettingsPage). Source : /api/ai/health (lecture seule).
 * Aucun appel provider réel côté serveur ; aucune donnée sensible exposée.
 */
type HealthReport = {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  checkedAt: string;
  environment: string;
  database: { connected: boolean; countersAccessible: boolean; logsAccessible: boolean };
  policy: { loaded: boolean; freeOnlyEnforced: boolean };
  quota: { managerOperational: boolean; minuteUsed: number; dayUsed: number };
  providers: Array<{ id: string; label: string; configured: boolean; enabled: boolean; freePolicyAllowed: boolean; status: string; reason?: string }>;
  usage24h: { requests: number; success: number; errors: number; quotaExceeded: number; byProvider: Record<string, number>; byModel: Record<string, number> };
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  UNHEALTHY: "danger",
};
const STATUS_ICON: Record<string, string> = { HEALTHY: "🟢", DEGRADED: "🟡", UNHEALTHY: "🔴", ready: "🟢", blocked: "⚪", not_configured: "⚪" };

export default function AiHealthCard() {
  const { session, authHeaders } = useAuth();
  const [env, setEnv] = useState<"production" | "demo">("production");
  const [data, setData] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch(`/api/ai/health?env=${env}`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: HealthReport) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [env, authHeaders]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (session?.role !== "SUPER_ADMIN") return null;

  const dot = (ok: boolean) => (ok ? "🟢" : "🔴");
  const row = (label: string, value: string | number) => (
    <div key={label} className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );

  return (
    <SectionCard title="AI Health" description="Santé du système IA — vue Super Admin." icon={HeartPulse}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Environnement</Label>
          <Select value={env} onValueChange={(v) => setEnv(v as "production" | "demo")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Officiel</SelectItem>
              <SelectItem value="demo">Démo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        {data && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{STATUS_ICON[data.status]} Global</span>
            <Pill tone={STATUS_TONE[data.status]}>{data.status}</Pill>
          </div>
        )}
      </div>

      {loading && !data && <p className="text-sm text-muted-foreground">Vérification…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-bold">Composants</p>
            {row("Database", `${dot(data.database.connected)} ${data.database.connected ? "Connected" : "Down"}`)}
            {row("Quota tables", `${dot(data.database.countersAccessible && data.database.logsAccessible)} ${data.database.countersAccessible && data.database.logsAccessible ? "Accessible" : "Error"}`)}
            {row("FREE POLICY", `${dot(data.policy.loaded && data.policy.freeOnlyEnforced)} ${data.policy.loaded ? (data.policy.freeOnlyEnforced ? "Active" : "Incohérente") : "Non chargée"}`)}
            {row("Quota Manager", `${dot(data.quota.managerOperational)} ${data.quota.managerOperational ? "Operational" : "Error"}`)}
            {row("Quota minute utilisé (global)", data.quota.minuteUsed)}
            {row("Quota jour utilisé (global)", data.quota.dayUsed)}
          </div>
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-bold">Providers (aucun appel réel)</p>
            {data.providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-semibold">
                  {STATUS_ICON[p.status] ?? ""}{" "}
                                    {p.status === "ready"
                    ? "Configuré / Free autorisé"
                    : p.reason === "FREE_POLICY_BLOCKED"
                      ? "Modèle payant refusé"
                      : p.reason === "NO_FREE_MODEL"
                        ? "Aucun modèle gratuit détecté"
                        : p.reason === "TOKEN_FREE_UNAVAILABLE"
                          ? "Catalogue indisponible"
                          : p.reason === "NO_API_KEY"
                            ? "Non configuré"
                            : p.status}
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border p-3 sm:col-span-2">
            <p className="mb-2 text-sm font-bold">Usage 24h — {data.environment === "demo" ? "Démo" : "Officiel"}</p>
            {row("Requests", data.usage24h.requests)}
            {row("Success", data.usage24h.success)}
            {row("Errors", data.usage24h.errors)}
            {row("Quota exceeded", data.usage24h.quotaExceeded)}
            {Object.entries(data.usage24h.byProvider).length > 0 && Object.entries(data.usage24h.byProvider).map(([k, v]) => row(`Provider ${k}`, v))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Last check: {data ? new Date(data.checkedAt).toLocaleString("fr-FR") : "—"}</p>
    </SectionCard>
  );
}
