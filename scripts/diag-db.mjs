// Diagnostic multi-config de connexion PostgreSQL.
import "dotenv/config";
import pg from "pg";

const base = process.env.DATABASE_URL;
const configs = [
  { name: "URL telle quelle", cs: base },
  { name: "sslmode=disable", cs: base + "?sslmode=disable" },
  { name: "host=[::1]", cs: base.replace("127.0.0.1", "[::1]") },
];

for (const cfg of configs) {
  const client = new pg.Client({ connectionString: cfg.cs, connectionTimeoutMillis: 6000 });
  try {
    await client.connect();
    const r = await client.query("SELECT 1 AS ok");
    console.log(`✅ ${cfg.name}: CONNECTÉ`, r.rows[0]);
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log(`❌ ${cfg.name}: ${e.code ?? ""} ${e.message}`);
    try { await client.end(); } catch { /* ignore */ }
  }
}
process.exit(1);