import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  sources?: string[];
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

  async function handleSend(directContent?: string) {
    const content = (directContent ?? input).trim();
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
      const data = (await res.json()) as { message?: string; conversationId?: string; error?: string; source?: string; label?: string; sources?: string[] };
      if (!res.ok || !data.message) {
        setError(data.error ?? "Erreur lors de la génération de la réponse.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      setCurrentConvId(data.conversationId ?? currentConvId);
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, role: "assistant", content: data.message ?? "", createdAt: new Date().toISOString(), sources: data.sources }]);
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
                      onClick={() => void handleSend(s)}
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
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "whitespace-pre-wrap rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted",
                    )}
                  >
                    {m.role === "assistant" ? <MarkdownLite content={m.content} /> : m.content}
                    {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                      <p className="mt-2 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
                        Données utilisées (serveur, périmètre autorisé) : {m.sources.join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Analyse des données scolaires…
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
  if (r === "ADMIN" || r === "SUPER_ADMIN") return "Copilote direction";
  if (r === "PARENT") return "Copilote parent";
  if (r === "STUDENT") return "Assistant élève";
  return "Copilote enseignant";
}

/** Suggestions contextuelles — adaptées au rôle et aux capacités réelles du copilote. */
function suggestionsForRole(role: string): string[] {
  const r = role.toUpperCase();
  if (r === "ADMIN" || r === "SUPER_ADMIN") {
    return [
      "Analyse les performances de mon établissement.",
      "Quels élèves ont besoin d'un accompagnement ?",
      "Compare cette période à la précédente.",
      "Pourquoi les absences augmentent-elles ?",
      "Prépare un rapport pour la direction.",
    ];
  }
  if (r === "PARENT") {
    return [
      "Comment évoluent les résultats de mon enfant ?",
      "Quelles matières nécessitent plus d'attention ?",
      "Quels devoirs sont à venir ?",
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

/** Rendu markdown minimal (titres ###, gras **, listes -) sans dépendance externe. */
function MarkdownLite({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  const inline = (text: string): ReactNode[] =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>,
    );
  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^[-•]\s/.test(l))) {
          return (
            <ul key={bi} className="ml-4 list-disc space-y-1">
              {lines.map((l, i) => <li key={i}>{inline(l.replace(/^[-•]\s/, ""))}</li>)}
            </ul>
          );
        }
                const headingIdx = block.indexOf("###");
        const headingEnd = headingIdx >= 0 ? block.indexOf("\n") : -1;
        const heading = headingIdx === 0 && (headingEnd === -1 || block.slice(0, 4) === "### ");
        if (heading) {
          const text = headingEnd === -1 ? block.slice(4) : block.slice(4, headingEnd);
          return (
            <p key={bi} className="pt-1 font-semibold first:pt-0">{inline(text)}</p>
          );
        }
        return <p key={bi}>{inline(block)}</p>;
      })}
    </div>
  );
}