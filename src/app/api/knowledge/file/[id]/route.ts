import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { aiGuard } from "@/lib/server/ai-guard";
import { PERMISSIONS } from "@/lib/server/rbac";
import { db } from "@/db";
import { knowledgeResources, knowledgeHistory } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Serve un fichier d'une ressource LOCALE (hébergée par l'établissement).
 * Contrôle d'accès strict :
 *   • authentification (KNOWLEDGE_READ) ;
 *   • ressource active ;
 *   • mode d'accès READ_IN_EDUSYNC ou DOWNLOAD_IN_EDUSYNC ;
 *   • scope + school_id (isolation multi-tenant) — jamais exposé à un autre établissement.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await aiGuard(req, PERMISSIONS.KNOWLEDGE_READ, "knowledge", "read_file");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await context.params;
  let row;
  try {
    row = (await db.select().from(knowledgeResources).where(eq(knowledgeResources.id, id)).limit(1))[0];
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  if (!row || row.status !== "active") {
    return NextResponse.json({ error: "Ressource introuvable ou indisponible." }, { status: 404 });
  }

  // Isolation multi-tenant : SUPER_ADMIN (tous) sinon même établissement.
  const isSuper = guard.ctx.role === "SUPER_ADMIN";
  const scope = (row.scope ?? "ESTABLISHMENT") as string;
  let allowedScope = scope === "GLOBAL";
  if (scope !== "GLOBAL") allowedScope = isSuper || (!!guard.ctx.schoolId && row.schoolId === guard.ctx.schoolId);
  if (!allowedScope) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  // Modes d'accès : lecture/téléchargement autorisés dans EduSync uniquement.
  const mode = row.accessMode ?? "UNAVAILABLE";
  if (mode !== "READ_IN_EDUSYNC" && mode !== "DOWNLOAD_IN_EDUSYNC") {
    return NextResponse.json({ error: "La ressource n'est pas lisible directement dans EduSync." }, { status: 403 });
  }

  const fileUrl = row.fileUrl;
  if (!fileUrl) return NextResponse.json({ error: "Aucun fichier associé." }, { status: 404 });

  try {
    await db.insert(knowledgeHistory).values({
      id: `${guard.ctx.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: guard.ctx.userId,
      resource_id: id,
      school_id: guard.ctx.schoolId,
      action: mode === "DOWNLOAD_IN_EDUSYNC" ? "DOWNLOAD" : "READ",
      created_at: new Date().toISOString(),
    });
  } catch {
    /* ne bloque jamais la lecture */
  }

  // Le fichier est référencé localement (soit chemin relatif, soit URL interne).
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return NextResponse.redirect(fileUrl);
  }
  return NextResponse.json({ file_url: fileUrl }, { status: 200, headers: { "Cache-Control": "private, max-age=60" } });
}