import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { qrCodes, qrScanHistory } from "@/db/schema";
import { newId } from "@/lib/server/data";
import { bindRequestEnvironment } from "@/lib/server/environment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  bindRequestEnvironment(req);
  const { token } = await params;
  if (!token) return NextResponse.json({ valid: false, result: "Token manquant" }, { status: 400 });
  try {
    const rows = await db.select().from(qrCodes).where(eq(qrCodes.token, token)).limit(1);
    const row = rows[0];
    const valid = Boolean(row);
    const result = valid
      ? `✓ Document authentique — ${row.type} « ${row.title} »`
      : "QR introuvable — token invalide";

    await db.insert(qrScanHistory).values({
      id: newId(),
      token,
      type: row?.type ?? "inconnu",
      result,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ valid, type: row?.type, title: row?.title, result });
  } catch (error) {
    console.error("[verify-qr]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
