import { NextRequest, NextResponse } from "next/server";
import { assertTable, updateRow, deleteRow } from "@/lib/server/data";
import { resolveDataEnvironment } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Édition d'une ligne dans l'environnement de la session. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ table: string; id: string }> }) {
  const env = await resolveDataEnvironment(req);
  if (!env) return NextResponse.json({ error: "Session ou environnement requis." }, { status: 401 });
  const { table, id } = await params;
  try {
    const t = assertTable(table);
    const body = await req.json();
    const row = await updateRow(t, id, body ?? {});
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
    const t = assertTable(table);
    const ok = await deleteRow(t, id);
    if (!ok) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
