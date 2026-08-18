import { useEffect, useState } from "react";
import { Bell, CheckCheck, Filter, MailOpen, AlertTriangle, Info, Megaphone, BookOpen, ClipboardList, CalendarDays, Wrench } from "lucide-react";
import { Button, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITIES, type Notification } from "../lib/types";
import { cn } from "../lib/utils";

/**
 * MODULE 10 — Centre de notifications unifié.
 * Catégories : SCOLARITE, ABSENCE, NOTE, DEVOIR, MESSAGE, ADMINISTRATION, SYSTEME, ALERT.
 * Filtrage + pagination + marquage lu/non-lu.
 */
export default function NotificationsPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [category, setCategory] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const userId = session?.userId ?? "";

  async function loadNotifications() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (unreadOnly) params.set("unreadOnly", "true");
      const res = await apiFetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { items: Notification[]; total: number; unread: number };
        setItems(data.items ?? []);
        setUnreadCount(data.unread ?? 0);
      } else {
        setError("Impossible de charger les notifications.");
      }
    } catch {
      setError("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, unreadOnly]);

  async function markRead(id: string, read: boolean) {
    try {
      const res = await apiFetch(`/api/notifications/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
        setUnreadCount((c) => (read ? Math.max(0, c - 1) : c + 1));
      }
    } catch {
      /* ignore */
    }
  }

  async function markAllAsRead() {
    try {
      const res = await apiFetch("/api/notifications/read-all", { method: "POST" });
      if (res.ok) {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">Centre de notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} notification(s) non lue(s)` : "Toutes les notifications sont lues."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void markAllAsRead()} disabled={unreadCount === 0}>
          <CheckCheck className="size-4" /> Tout marquer comme lu
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <Filter className="size-4 text-muted-foreground" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {Object.entries(NOTIFICATION_CATEGORIES).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Non lues uniquement
        </label>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-destructive/5 p-6 text-center text-sm text-destructive">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-card p-16 text-center">
          <Bell className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="font-semibold">Aucune notification</p>
          <p className="text-sm text-muted-foreground">Les nouvelles notifications apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors",
                !n.read && "border-primary/30 bg-primary/5",
              )}
            >
              <div className={cn("mt-0.5 rounded-lg p-2", !n.read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {iconForCategory(n.category)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    {n.priority === "high" && (
                      <Badge className="bg-destructive/10 text-destructive">Prioritaire</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString("fr-FR")} {new Date(n.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-muted text-muted-foreground">{NOTIFICATION_CATEGORIES[n.category] ?? n.category}</Badge>
                  {!n.read && (
                    <button
                      onClick={() => void markRead(n.id, true)}
                      className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Marquer comme lu
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function iconForCategory(category: string) {
  switch (category) {
    case "ABSENCE": return <AlertTriangle className="size-4" />;
    case "NOTE": return <ClipboardList className="size-4" />;
    case "DEVOIR": return <BookOpen className="size-4" />;
    case "MESSAGE": return <Bell className="size-4" />;
    case "ADMINISTRATION": return <Megaphone className="size-4" />;
    case "SYSTEME": return <Wrench className="size-4" />;
    case "ALERT": return <AlertTriangle className="size-4" />;
    default: return <CalendarDays className="size-4" />;
  }
}