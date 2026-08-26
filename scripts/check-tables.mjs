// Vérifie les tables ai_usage_* dans public/demo et synchronise le schéma demo.
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const r = await pool.query(
    "SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('ai_usage_counters','ai_usage_logs') ORDER BY 1,2",
  );
  console.log("Tables trouvées:", JSON.stringify(r.rows));

  // Synchronise le schéma demo (comme ensureDemoSchema) : duplique les tables manquantes.
  const client = await pool.connect();
  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS demo");
    const { rows } = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('ai_usage_counters','ai_usage_logs')",
    );
    for (const row of rows) {
      const name = String(row.tablename);
      await client.query(`CREATE TABLE IF NOT EXISTS demo."${name}" (LIKE public."${name}" INCLUDING ALL)`);
      console.log(`demo.${name} synchronisé`);
    }
  } finally {
    client.release();
  }

  const r2 = await pool.query(
    "SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('ai_usage_counters','ai_usage_logs') ORDER BY 1,2",
  );
  console.log("Tables finales:", JSON.stringify(r2.rows));
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });