/**
 * EDUSYNC PRO — Vérification reproductible du schéma Quota IA.
 *
 * Détecteur SAFE (lecture seule par défaut) de l'état des tables et index
 * utilisés par AIQuotaManager :
 *
 *   tables :  ai_usage_counters · ai_usage_logs
 *   index  :  ai_usage_counters_key_idx · ai_usage_logs_user_idx · ai_usage_logs_school_idx
 *
 * Le script ne modifie JAMAIS la base :
 * - aucune suppression / aucun DROP ;
 * - aucune création automatique ;
 * - aucune donnée modifiée.
 *
 * Sortie :
 *   - rapport lisible "AI QUOTA SCHEMA" ;
 *   - code 0 si tout est présent (READY) ;
 *   - code non nul si un objet manque (NOT READY) avec le message
 *     "MISSING — run schema synchronization".
 *
 * Exécution :
 *   node scripts/sync-ai-quota-schema.mjs
 * (via package.json : npm run db:check-ai-quota)
 */
import "dotenv/config";
import pg from "pg";

const TABLES = ["ai_usage_counters", "ai_usage_logs"];
const INDEXES = [
  "ai_usage_counters_key_idx",
  "ai_usage_logs_user_idx",
  "ai_usage_logs_school_idx",
];

/** Affiche l'état de la cible sans exposer la valeur de DATABASE_URL. */
function databaseScope(url) {
  if (!url) return "UNKNOWN";
  const host = /@([^:/?]+)/.exec(url)?.[1] ?? /host=([^\s]+)/.exec(url)?.[1] ?? "";
  if (/127\.0\.0\.1|localhost/i.test(host)) return "LOCAL";
  return "DISTANTE";
}

function line(label, ok) {
  console.log(`${label}: ${ok ? "OK" : "MISSING"}`);
  return ok;
}

async function main() {
  const url = process.env.DATABASE_URL;
  const scope = databaseScope(url);

  console.log("AI QUOTA SCHEMA");
  console.log("---------------");
  console.log(`database: ${scope}`);

  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: url });
  let ready = true;

  try {
    const tables = new Set();
    const { rows: tableRows } = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1)",
      [TABLES],
    );
    for (const r of tableRows) tables.add(r.tablename);

    for (const name of TABLES) {
      const ok = line(name, tables.has(name));
      if (!ok) ready = false;
    }

    const indexes = new Set();
    const { rows: indexRows } = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1)",
      [INDEXES],
    );
    for (const r of indexRows) indexes.add(r.indexname);

    const counterUnique = line("counter_unique_index", indexes.has("ai_usage_counters_key_idx"));
    const logsUser = line("logs_user_index", indexes.has("ai_usage_logs_user_idx"));
    const logsSchool = line("logs_school_index", indexes.has("ai_usage_logs_school_idx"));
    if (!counterUnique || !logsUser || !logsSchool) ready = false;
  } catch (err) {
    console.error(`DB_ERROR: ${err.code ?? ""} ${String(err.message).slice(0, 120)}`);
    process.exit(1);
  } finally {
    await pool.end();
  }

  if (ready) {
    console.log("status: READY");
    process.exit(0);
  } else {
    console.log("status: NOT READY");
    console.error("MISSING — run schema synchronization");
    process.exit(1);
  }
}

main();