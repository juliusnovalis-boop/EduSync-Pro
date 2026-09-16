import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { assertTable, countRows, wipeTable, bulkInsert, type TableName } from "@/lib/server/data";
import { buildSeedData, SEED_TABLES } from "@/lib/server/seed-data";
import { ensureAppDefaults } from "@/lib/server/ensure-defaults";
import { requirePermission } from "@/lib/server/auth";
import { PERMISSIONS } from "@/lib/server/rbac";
import { logAudit, AUDIT_ACTIONS } from "@/lib/server/audit";
import { bindRequestEnvironment } from "@/lib/server/environment";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  bindRequestEnvironment(req);
  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "1";

  /**
   * F-18 (pentest #2) : TOUTE exécution du seed écrit des données → la
   * permission SYSTEM_MANAGE est OBLIGATOIRE sur tous les chemins (reset ou
   * non), quels que soient les query params, headers ou l'environnement.
   * Un anonyme reçoit 401 ; un authentifié sans SYSTEM_MANAGE reçoit 403.
   */
  const auth = await requirePermission(req, PERMISSIONS.SYSTEM_MANAGE);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (reset) {
    await logAudit({ actor_id: auth.actor.userId, actor_role: auth.actor.role, action: AUDIT_ACTIONS.SEED_RESET });
  }

  try {
    if (reset) {
      for (const table of SEED_TABLES) {
        await wipeTable(assertTable(table));
      }
      await db.delete(appUsers);
    }

    await ensureAppDefaults();

    const data = buildSeedData();
    const inserted: Record<string, number> = {};
    for (const table of SEED_TABLES) {
      const t = assertTable(table) as TableName;
      const count = await countRows(t);
      if (count === 0 && data[table]?.length) {
        await bulkInsert(t, data[table]);
        inserted[table] = data[table].length;
      } else {
        inserted[table] = 0;
      }
    }

    return NextResponse.json({ ok: true, reset, inserted });
  } catch (error) {
    console.error("[seed]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
