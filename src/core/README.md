# Core EduSync Pro — socle modulaire & extensible

Sous-système **additif** (`src/core`) qui fait évoluer l'app vers une architecture
modulaire découplée, **sans modifier le code existant** (Open/Closed).

## Composition

```
src/core/
├─ interfaces/index.ts      Contrats : IModule, IPlugin, IService, ICapability, CoreEvent
├─ kernel/
│  ├─ kernel.ts             Assemblage (boot, use(module), install(plugin), status)
│  ├─ event-bus.ts          Communication découplée (emit/on/off) + isolation d'erreurs
│  ├─ container.ts          DI : register/factory/resolve (substitution d'implémentation)
│  ├─ registry.ts           Modules : register/get/byCapability/enable/disable + isolation
│  ├─ capabilities.ts       Catalogue capacités (ocr.extract, qr.generate…) + constantes
│  └─ config.ts             Config centralisée : env + feature flags (modules)
├─ services/
│  ├─ ai/
│  │  ├─ ai-provider.ts     Contrat IAIProvider (+ types chat/ocr/transcribe/analyse)
│  │  ├─ providers.ts       GeminiProvider, HuggingFaceProvider, LocalProvider
│  │  ├─ registry.ts        AIProviderRegistry (sélection par priorité = fin des if/else)
│  │  └─ ai-service.ts      AIService (IModule) : analyze/extractGrades/transcribe + events
│  ├─ repository.ts         Contrat IRepository (data.ts l'implémente déjà)
│  └─ identity.ts           Contrat IIdentityService (auth.ts l'implémente déjà)
└─ index.ts                 API publique
```

## Utilisation (exemple)

```ts
import { Kernel, AIService, GeminiProvider, HuggingFaceProvider, LocalProvider } from "@/core";

const kernel = new Kernel();
const ai = new AIService();
ai.registerProvider(new GeminiProvider())
  .registerProvider(new HuggingFaceProvider())
  .registerProvider(new LocalProvider());

kernel.use(ai);          // enregistre le module + ses capacités
await kernel.boot();     // initialise (isolé)

await ai.analyze(params);           // → rapport pédagogique (Gemini→HF→local)
ai.activeProvider();                // → provider sélectionné (1 source de vérité)
ai.label();                         // → "Google Gemini" | "Hugging Face" | "Moteur local"
kernel.eventBus.on("ai.analysis.completed", (e) => { /* … */ });
```

## Ajouter un fournisseur IA (OpenAI, Claude, Mistral…)

```ts
class OpenAIProvider implements IAIProvider { /* … */ }
ai.registerProvider(new OpenAIProvider());   // ← c'est TOUT. Aucun if/else à toucher.
```

## État d'avancement (cf. docs/architecture/03-migration-plan.md)

- ✅ **P0** Socle Core (Kernel, DI, EventBus, Registry, CapabilityCatalog, Config).
- ✅ **P1** IAIProvider + 3 plugins + AIProviderRegistry + AIService (façade compat).
- ⏳ **P2** Brancher `/api/ai`, `/api/ocr`, `/api/transcribe` sur le Core.
- ⏳ **P3** ConfigManager centralisé + feature flags.
- ⏳ **P4** EventBus métier (notes→bulletins→classement).
- ⏳ **P5** Conformité data.ts/auth.ts aux contrats IRepository/IIdentityService.
- ⏳ **P6** Plugin loader ouvert (découverte/validate/register).

> Pendant P1, les providers délèguent aux fonctions existantes de `@/lib/server/ai`
> (couche de compatibilité temporaire : zéro duplication, zéro régression).
