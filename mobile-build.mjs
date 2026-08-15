/**
 * Script de build MOBILE pour EduSync Pro.
 *
 * Le build mobile (Capacitor/Android) nécessite un export STATIQUE (`out/`).
 * Or les routes API Next.js (force-dynamic) sont incompatibles avec `output: "export"`.
 *
 * Stratégie (compatible Windows) :
 *   1. Copie `src/app/api` → `src/app/api.bak`
 *   2. Supprime `src/app/api` (évite les problèmes de verrouillage EPERM)
 *   3. Lance `next build` en mode MOBILE_BUILD=1 (export statique)
 *   4. Restaure `src/app/api` à partir du backup
 *   5. Synchronise Capacitor avec le build
 *
 * Usage : node mobile-build.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const apiDir = join(root, "src", "app", "api");
const apiBackup = join(root, "src", ".api-backup");

let apiMoved = false;

function step(msg) {
  console.log(`\n\x1b[36m▶ ${msg}\x1b[0m`);
}

function fail(msg) {
  console.error(`\n\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

try {
  // 1. Vérifie l'existence du dossier api
  if (!existsSync(apiDir)) {
    fail("Le dossier src/app/api est introuvable. Abandon.");
  }

  // 2. Si un backup existe déjà d'un run précédent, le nettoyer d'abord
  if (existsSync(apiBackup)) {
    step("Nettoyage d'un backup précédent…");
    rmSync(apiBackup, { recursive: true, force: true });
  }

  // 3. Copie api → api.bak, puis supprime api
  step("Déplacement de src/app/api → src/app/api.bak (exclusion des routes API)…");
  cpSync(apiDir, apiBackup, { recursive: true });
  rmSync(apiDir, { recursive: true, force: true });
  apiMoved = true;

  // 4. Nettoyage des dossiers out et .next-mobile (pas `.next` : souvent verrouillé sur Windows)
  const outDir = join(root, "out");
  const nextDir = join(root, ".next-mobile");
  if (existsSync(outDir)) {
    step("Nettoyage du dossier out/…");
    rmSync(outDir, { recursive: true, force: true });
  }
  if (existsSync(nextDir)) {
    step("Nettoyage du dossier .next-mobile/…");
    rmSync(nextDir, { recursive: true, force: true });
  }

  // 5. Build statique mobile
  step("Build statique Next.js (MOBILE_BUILD=1)…");
  process.env.MOBILE_BUILD = "1";
  execSync("next build", { cwd: root, stdio: "inherit" });

  // 6. Copie l'export statique .next-mobile → out/ (attendu par Capacitor)
  step("Copie de .next-mobile/ → out/ (export statique)…");
  cpSync(nextDir, outDir, { recursive: true });

  // 7. Synchronisation Capacitor
  step("Synchronisation Capacitor (npx cap sync android)…");
  execSync("npx cap sync android", { cwd: root, stdio: "inherit" });

  // 7. Restauration du dossier api
  if (apiMoved) {
    step("Restauration de src/app/api…");
    cpSync(apiBackup, apiDir, { recursive: true });
    rmSync(apiBackup, { recursive: true, force: true });
    apiMoved = false;
  }

  console.log("\n\x1b[32m✓ Build mobile terminé avec succès !\x1b[0m");
} catch (err) {
  // Restaure toujours le dossier api en cas d'erreur
  if (apiMoved && existsSync(apiBackup) && !existsSync(apiDir)) {
    console.error("\n\x1b[33mRestauration du dossier api après erreur…\x1b[0m");
    try {
      cpSync(apiBackup, apiDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  console.error(`\n\x1b[31m✗ Échec du build mobile :\x1b[0m`, err.message ?? err);
  process.exit(1);
}