import { NextRequest, NextResponse } from "next/server";
import { assertTable, updateRow, deleteRow, getRowOwnerId, type TableName } from "@/lib/server/data";
import { resolveDataEnvironment, requirePermission } from "@/lib/server/auth";
import { OWNER_COLUMNS, canWriteRow, requiredPermission } from "@/lib/server/data-policy";

export const dynamic = "force-dynamic";

/**
 * F-7 (pentest #2) : une session ne suffit PAS. Chaque PUT/DELETE exige :
 *   1) authentification (requirePermission) ;
 *   2) permission par table (matrice data-policy) ;
 *   3) contrôle de PROPRIÉTÉ de la ligne chargée (anti-IDOR) pour tout acteur
 *      de rang < ADMIN sur les tables owner-scoped ;
 *   4) refus total des tables gérées par des routes dédiées (students/teachers).
 */
async function authorizeRowAccess(
  req: NextRequest,
  table: string,
  id: string,
  op: "update" | "delete",
): Promise<{ ok: true; table: ReturnType<typeof assertTable> } | { ok: false; status: number; error: string }> {
  const t = assertTable(table);
  if (table === "students" || table === "teachers") {
    return { ok: false, status: 403, error: "Fiches métier gérées via la Gestion des accès." };
  }
  const perm = requiredPermission(t, op);
  if (!perm) return { ok: false, status: 403, error: "Opération interdite sur cette table." };
  const auth = await requirePermission(req, perm);
  if ("error" in auth) {
    return { ok: false, status: auth.status ?? 401, error: auth.error ?? "Non authentifié" };
  }

  // Anti-IDOR : charger la ligne et vérifier la propriété pour les non-ADMIN.
  const ownerCol = OWNER_COLUMNS[t];
  const { exists, ownerId } = await getRowOwnerId(t, id, ownerCol);
  if (!exists) return { ok: false, status: 404, error: "Introuvable" };
  if (ownerCol && !canWriteRow(auth.actor.role, ownerId, auth.actor.userId)) {
    return { ok: false, status: 403, error: "Accès refusé" };
  }
  return { ok: true, table: t };
}

/** Édition d'une ligne dans l'environnement de la session. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ table: string; id: string }> }) {
  const env = await resolveDataEnvironment(req);
  if (!env) return NextResponse.json({ error: "Session ou environnement requis." }, { status: 401 });
  const { table, id } = await params;
  try {
    const gate = await authorizeRowAccess(req, table, id, "update");
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const body = await req.json();
    const row = await updateRow(gate.table, id, body ?? {});
    if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

/** Suppression d'une ligne dans l'environnement de la session. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ table: string; id: string }> }) {
  const env = await resolveDataEnvironment(req);
  if (!env) return NextResponse.json({ error: "Session ou environnement requis." }, { status: 401 });
  const { table, id } = await params;
  try {
    const gate = await authorizeRowAccess(req, table, id, "delete");
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const ok = await deleteRow(gate.table, id);
    if (!ok) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

