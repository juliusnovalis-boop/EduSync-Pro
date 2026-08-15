import { NextRequest, NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { academicYears } from "@/db/schema";
import { requirePermission } from "@/lib/server/auth";
import { PERMISSIONS } from "@/lib/server/rbac";
import { logAudit, AUDIT_ACTIONS } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

/** Archiver toutes les autres années actives (règle : une seule ACTIVE à la fois). */
async function archiveOtherActive(keepId: string) {
  const now = new Date().toISOString();
  await db
    .update(academicYears)
    .set({ status: "ARCHIVED", updated_at: now })
    .where(and(eq(academicYears.status, "ACTIVE"), ne(academicYears.id, keepId)));
}

function norm(input?: string): string | null {
  const v = String(input ?? "").trim();
  return v || null;
}

/** GET /api/academic-years — liste toutes les années (lecture : ACADEMIC_YEAR_READ). */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.ACADEMIC_YEAR_READ);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const rows = await db.select().from(academicYears).orderBy(academicYears.start_date);
  return NextResponse.json(rows);
}

/** POST /api/academic-years — crée une année (ACADEMIC_YEAR_MANAGE). */
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.ACADEMIC_YEAR_MANAGE);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const actor = auth.actor;

  try {
    const { name, start_date, end_date, status } = (await req.json()) as {
      name?: string;
      start_date?: string;
      end_date?: string;
      status?: string;
    };
    if (!String(name ?? "").trim()) {
      return NextResponse.json({ error: "Le nom de l'année est requis (ex. 2026–2027)." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const finalStatus = status === "ACTIVE" ? "ACTIVE" : status === "ARCHIVED" ? "ARCHIVED" : "DRAFT";
    const id = `ay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const [created] = await db
      .insert(academicYears)
      .values({
        id,
        name: String(name).trim(),
        start_date: norm(start_date),
        end_date: norm(end_date),
        status: finalStatus,
        created_at: now,
        updated_at: now,
        created_by: actor.userId,
      })
      .returning();

    if (finalStatus === "ACTIVE") await archiveOtherActive(created.id);
    await logAudit({
      actor_id: actor.userId,
      actor_role: actor.role,
      action: finalStatus === "ACTIVE" ? AUDIT_ACTIONS.ACADEMIC_YEAR_ACTIVATED : AUDIT_ACTIONS.ACADEMIC_YEAR_CREATED,
      target_id: created.id,
      metadata: { name: created.name },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** PUT /api/academic-years — modifie / active / archive une année (ACADEMIC_YEAR_MANAGE). */
export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.ACADEMIC_YEAR_MANAGE);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const actor = auth.actor;

  try {
    const { id, name, start_date, end_date, status } = (await req.json()) as {
      id?: string;
      name?: string;
      start_date?: string;
      end_date?: string;
      status?: string;
    };
    if (!id) return NextResponse.json({ error: "Identifiant d'année requis." }, { status: 400 });

    const existing = await db.select().from(academicYears).where(eq(academicYears.id, id)).limit(1);
    if (!existing.length) return NextResponse.json({ error: "Année introuvable." }, { status: 404 });
    const prev = existing[0];

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };
    if (typeof name === "string" && name.trim()) patch.name = name.trim();
    if (start_date !== undefined) patch.start_date = norm(start_date);
    if (end_date !== undefined) patch.end_date = norm(end_date);
    const finalStatus = status === "ACTIVE" ? "ACTIVE" : status === "ARCHIVED" ? "ARCHIVED" : status === "DRAFT" ? "DRAFT" : undefined;
    if (finalStatus) patch.status = finalStatus;

    const [updated] = await db.update(academicYears).set(patch).where(eq(academicYears.id, id)).returning();

    // Règle « une seule année active » : activation → archive les autres.
    if (finalStatus === "ACTIVE") await archiveOtherActive(updated.id);

    const activated = finalStatus === "ACTIVE" && prev.status !== "ACTIVE";
    const archived = finalStatus === "ARCHIVED" && prev.status !== "ARCHIVED";
    await logAudit({
      actor_id: actor.userId,
      actor_role: actor.role,
      action: activated
        ? AUDIT_ACTIONS.ACADEMIC_YEAR_ACTIVATED
        : archived
          ? AUDIT_ACTIONS.ACADEMIC_YEAR_ARCHIVED
          : AUDIT_ACTIONS.ACADEMIC_YEAR_UPDATED,
      target_id: updated.id,
      metadata: { name: updated.name, from: prev.status, to: finalStatus ?? prev.status },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
