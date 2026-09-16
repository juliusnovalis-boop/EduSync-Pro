import { NextRequest, NextResponse } from "next/server";
import { assertTable, listRows, createRow, bulkInsert, scopeRowsForActor, attachAccountInfo } from "@/lib/server/data";
import { resolveDataEnvironment, getSessionActor, requirePermission } from "@/lib/server/auth";
import { requiredPermission } from "@/lib/server/data-policy";

export const dynamic = "force-dynamic";

/**
 * F-22 (pentest #2) — Plafond dur de pagination. Toute valeur `limit` reçue
 * hors de [1, MAX_LIST_LIMIT] est ramenée dans cet intervalle : impossible de
 * demander l'extraction intégrale d'une table en une seule requête.
 */
const MAX_LIST_LIMIT = 500;

/**
 * Routes de données génériques (dashboard, élèves, enseignants, classes…).
 * L'ENVIRONNEMENT est résolu depuis la SESSION authentifiée (source unique,
 * cohérente avec /api/auth/users) — jamais depuis le seul cookie. En cas
 * d'environnement indéterminé, on renvoie une erreur explicite (jamais []).
 *
 * F-7 (pentest #2) : matrice d'autorisation DENY BY DEFAULT (data-policy.ts)
 * appliquée en plus du scoping par rôle.
 */

/** Lecture : liste les lignes d'une table dans l'environnement de la session. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const env = await resolveDataEnvironment(req);
  if (!env) return NextResponse.json({ error: "Session ou environnement requis." }, { status: 401 });
  const { table } = await params;
  try {
    const t = assertTable(table);
    // F-7 : contrôle de lecture par table (refus 403 si non autorisé).
    const readPerm = requiredPermission(t, "read");
    if (readPerm) {
      const auth = await requirePermission(req, readPerm);
      if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const url = new URL(req.url);
    const order = url.searchParams.get("order") || "created_at";
    const ascending = url.searchParams.get("ascending") === "true";
    /*
     * F-22 (pentest #2) — `limit` n'était pas borné : un appelant pouvait
     * demander `?limit=10000` (voire davantage) et forcer l'extraction de toute
     * la table en une requête, avec un coût mémoire/CPU serveur non maîtrisé
     * (déni de service + exfiltration massive facilitée).
     * Désormais : entier valide, borné à [1, MAX_LIST_LIMIT].
     */
    const rawLimit = Number(url.searchParams.get("limit") ?? MAX_LIST_LIMIT);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIST_LIMIT)
      : MAX_LIST_LIMIT;
    const actor = await getSessionActor(req);
    let rows = await listRows(t, { order, ascending, limit });
    // Périmètre par rôle (multi-établissements) : TEACHER → ses classes affectées,
    // PARENT → ses enfants liés, STUDENT → ses propres données. ADMIN/SUPER_ADMIN : inchangé.
    rows = await scopeRowsForActor(t, rows, actor ? { role: actor.role, userId: actor.userId } : null);
    // Liaison réelle avec app_users (login_id / statut du compte) pour students & teachers.
    rows = await attachAccountInfo(t, rows);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

/**
 * Création / insertion en masse dans l'environnement de la session.
 *
 * Règle métier (réforme des comptes) : la création de fiches métier STUDENT /
 * TEACHER n'est jamais autorisée via l'API générique. Une fiche métier ne peut
 * exister que liée à un compte app_users créé de manière atomique depuis
 * /api/auth/users (→ « Gestion des accès »). Seules les créations en bloc
 * (import historique / réconciliation) sont tolérées sur ces tables-là.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const env = await resolveDataEnvironment(req);
  if (!env) return NextResponse.json({ error: "Session ou environnement requis." }, { status: 401 });
  const { table } = await params;
  try {
    const t = assertTable(table);
    // F-7 : écriture par table = permission stricte (STUDENT/PARENT auto-refusés).
    const writePerm = requiredPermission(t, "create");
    if (!writePerm) return NextResponse.json({ error: "Opération interdite sur cette table." }, { status: 403 });
    const auth = await requirePermission(req, writePerm);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json();
    const isBulk = Array.isArray(body) || (body && typeof body === "object" && "upsert" in body && Array.isArray(body.rows));
    // Refus de la création normale de fiche métier orpheline — flux normal = /api/auth/users.
    if (!isBulk && (table === "students" || table === "teachers")) {
      return NextResponse.json(
        { error: "Création de fiches métier réservée aux routes dédiées (Gestion des accès)." },
        { status: 403 },
      );
    }
    if (isBulk) {
      return NextResponse.json(await bulkInsert(t, Array.isArray(body) ? body : body.rows, Array.isArray(body) ? false : true), { status: 201 });
    }
    const row = await createRow(t, body ?? {});
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
