# EduSync Pro

Plateforme de gestion scolaire — Next.js (App Router) + PostgreSQL (Drizzle ORM).

## IA

### Providers

- **Gemini** (`gemini`) — niveau gratuit Google, priorité 1
- **OpenRouter** (`openrouter`) — mécanisme `openrouter/free` + modèles `:free`, priorité 2
- **Hugging Face** (`huggingface`) — bloqué tant que le pricing n'est pas vérifié
- **Ollama Cloud** (`ollama`) — additif, bloqué par défaut (pricing inconnu), voir FREE ONLY

### Secrets

Toutes les clés / API tokens sont stockés **exclusivement dans `.env`**
(jamais dans le code source, jamais versionné, jamais exposé au frontend).

Variables serveur :

```
OLLAMA_API_KEY=
OLLAMA_BASE_URL=https://ollama.com

GEMINI_API_KEY=
OPENROUTER_API_KEY=
HF_TOKEN=
```

Modèles Ollama (IDs publics, optionnels) :

```
# OLLAMA_MODEL_DEFAULT=
# OLLAMA_MODEL_GENERAL=
# OLLAMA_MODEL_EDUCATION=
# OLLAMA_MODEL_REASONING=
# OLLAMA_MODEL_MATH=
# OLLAMA_MODEL_FALLBACK=
```

> Ne mettre AUCUNE vraie valeur ici ni dans `.env.example`.

### FREE ONLY

Politique stricte :

- prix > 0 → **BLOQUÉ**
- prix inconnu → **BLOQUÉ** (`UNKNOWN_PRICING`)
- prix non vérifiable → **BLOQUÉ**
- gratuité prouvée → autorisé

Ollama Cloud n'est autorisé que lorsqu'un modèle est explicitement listé dans
`OLLAMA_FREE_VERIFIED_MODELS` (preuve humaine de gratuité configurée côté hébergeur).
Le catalogue `src/lib/server/ai-models.ts` ne constitue **pas** une preuve de gratuité.

### Architecture

```
Route (/api/ai/chat, /api/ai/gateway, …)
→ aiGuard          # auth + RBAC + environnement
→ aiGateway        # quotas, cache, audit, FREE ONLY
→ aiRouter         # décision provider/modèle + fallback chain
→ aiPolicy         # checkModelIsFree / PROVIDER_PRIORITY
→ Provider         # gemini | openrouter | ollama (server-only)
```

Aucun appel provider direct depuis une route ou le frontend.
Chaque appel passe par `AIQuotaManager` (compteurs persistants) et l'audit.

### Tests

```
npm run test:ollama       # intégration Ollama (19 cas, aucune clé réelle requise)
npm run db:check-ai-quota # schéma des compteurs de quota
npm run typecheck         # tsc --noEmit
```
