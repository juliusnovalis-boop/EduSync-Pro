import { NextRequest, NextResponse } from "next/server";
import { assertTable, listRows, createRow, bulkInsert } from "@/lib/server/data";
import { resolveDataEnvironment } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * Routes de données génériques (dashboard, élèves, enseignants, classes…).
 * L'ENVIRONNEMENT est résolu depuis la SESSION authentifiée (source unique,
 * cohérente avec /api/auth/users) — jamais depuis le seul cookie. En cas
 * d'environnement indéterminé, on renvoie une erreur explicite (jamais []).
 */

/** Lecture : liste les lignes d'une table dans l'environnement de la session. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const env = await resolveDataEnvironment(req);
  if (!env) return NextResponse.json({ error: "Session ou environnement requis." }, { status: 401 });
  const { table } = await params;
  try {
    const t = assertTable(table);
    const url = new URL(req.url);
    const order = url.searchParams.get("order") || "created_at";
    const ascending = url.searchParams.get("ascending") === "true";
    const limit = Number(url.searchParams.get("limit") ?? 2000);
    const rows = await listRows(t, { order, ascending, limit });
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

/** Création / insertion en masse dans l'environnement de la session. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const env = await resolveDataEnvironment(req);
  if (!env) return NextResponse.json({ error: "Session ou environnement requis." }, { status: 401 });
  const { table } = await params;
  try {
    const t = assertTable(table);
    const body = await req.json();
    if (Array.isArray(body)) {
      return NextResponse.json(await bulkInsert(t, body), { status: 201 });
    }
    if (body && typeof body === "object" && "upsert" in body && Array.isArray(body.rows)) {
      return NextResponse.json(await bulkInsert(t, body.rows, true), { status: 201 });
    }
    const row = await createRow(t, body ?? {});
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
