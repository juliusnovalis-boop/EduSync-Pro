import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Bot, Trash2, Loader2 } from "lucide-react";
import { Button, Textarea } from "../components/ui";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import type { AIConversation, AIConversationMessage } from "../lib/types";
import { cn } from "../lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

/**
 * MODULE 4 / 6 / 7 — Assistant EduSync.
 * Unifié par rôle : TEACHER → assistant enseignant, ADMIN → assistant admin, PARENT → assistant parent.
 * Historique des conversations persisté côté serveur, pagination via la liste des conversations.
 */
export default function AiAssistantPage() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const role = session?.role ?? "TEACHER";
  const assistantLabel = roleLabel(role);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    try {
      const res = await apiFetch("/api/ai/chat?conversations=1");
      if (res.ok) {
        const data = (await res.json()) as { conversations: AIConversation[] };
        setConversations(data.conversations ?? []);
      }
    } catch {
      /* hors ligne */
    }
  }

  async function loadMessages(convId: string) {
    setCurrentConvId(convId);
    setMessages([]);
    try {
      const res = await apiFetch(`/api/ai/chat?conversationId=${encodeURIComponent(convId)}&limit=100`);
      if (res.ok) {
        const data = (await res.json()) as { messages: AIConversationMessage[] };
        const mapped: ChatMessage[] = (data.messages ?? [])
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content ?? "",
            createdAt: m.created_at,
          }));
        setMessages(mapped);
      }
    } catch {
      setError("Impossible de charger l'historique.");
    }
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || loading) return;
    setInput("");
    setLoading(true);
    setError("");
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() }]);
    try {
      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, conversationId: currentConvId ?? undefined }),
      });
      const data = (await res.json()) as { message?: string; conversationId?: string; error?: string; source?: string; label?: string };
      if (!res.ok || !data.message) {
        setError(data.error ?? "Erreur lors de la génération de la réponse.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      setCurrentConvId(data.conversationId ?? currentConvId);
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, role: "assistant", content: data.message ?? "", createdAt: new Date().toISOString() }]);
      await loadConversations();
    } catch {
      setError("Erreur de connexion au serveur.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setMessages([]);
    setCurrentConvId(null);
    setInput("");
    setError("");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">Assistant EduSync</h1>
          <p className="text-sm text-muted-foreground">
            {assistantLabel} · Contexte adapté à votre rôle — les données sont filtrées selon vos permissions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={newChat}>
          <Trash2 className="size-4" /> Nouvelle conversation
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Historique des conversations */}
        <aside className="hidden rounded-xl border bg-card p-4 lg:block">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Conversations</h2>
          <div className="space-y-1">
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune conversation.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadMessages(c.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    currentConvId === c.id ? "bg-accent font-medium text-accent-foreground" : "hover:bg-accent/50",
                  )}
                >
                  <span className="line-clamp-1">{c.title ?? "Conversation"}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {new Date(c.updated_at ?? c.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Zone de chat */}
        <div className="flex min-h-[60vh] flex-col rounded-xl border bg-card">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
                <span className="gradient-primary flex size-14 items-center justify-center rounded-2xl text-primary-foreground shadow-[var(--shadow-float)]">
                  <Bot className="size-7" />
                </span>
                <div>
                  <p className="font-semibold">{assistantLabel}</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Posez une question sur les résultats, les notes, les absences, les devoirs ou demandez de l'aide pédagogique.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 px-4">
                  {suggestionsForRole(role).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s);
                        handleSend();
                      }}
                      className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  L'assistant réfléchit…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t p-4">
            {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Écrivez votre demande à l'assistant…"
                className="min-h-[44px] flex-1 resize-none"
              />
              <Button onClick={() => void handleSend()} disabled={loading || !input.trim()} size="icon">
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  const r = role.toUpperCase();
  if (r === "ADMIN" || r === "SUPER_ADMIN") return "Assistant administratif";
  if (r === "PARENT") return "Assistant parent";
  if (r === "STUDENT") return "Assistant élève";
  return "Assistant enseignant";
}

function suggestionsForRole(role: string): string[] {
  const r = role.toUpperCase();
  if (r === "ADMIN" || r === "SUPER_ADMIN") {
    return [
      "Analyse les résultats de cet établissement.",
      "Quels niveaux ont les plus grandes difficultés ?",
      "Prépare le rapport mensuel.",
      "Compare les performances des classes.",
    ];
  }
  if (r === "PARENT") {
    return [
      "Comment évoluent les résultats de mon enfant ?",
      "Quelles matières nécessitent plus d'attention ?",
      "Quels devoirs sont actuellement disponibles ?",
    ];
  }
  if (r === "STUDENT") {
    return ["Explique-moi une notion.", "Propose des exercices de révision."];
  }
  return [
    "Explique une notion.",
    "Propose une activité pour ma classe.",
    "Crée des exercices.",
    "Génère une évaluation.",
  ];
}