import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { qrCodes, qrScanHistory } from "@/db/schema";
import { newId } from "@/lib/server/data";
import { bindRequestEnvironment } from "@/lib/server/environment";
import {
  clientIp,
  ensureRateLimitSchema,
  internalErrorResponse,
  loginRateLimiter,
  SENSITIVE_ENDPOINT_LIMIT,
  type WindowResult,
} from "@/lib/server/security";

export const dynamic = "force-dynamic";

/**
 * F-20 (pentest #2) — Vérification de document par QR.
 *
 * Cet endpoint est PUBLIC par nature (un tiers scanne un QR sans compte), mais
 * il constituait un ORACLE d'énumération : sans limite de débit ni validation
 * de forme, un attaquant pouvait balayer l'espace des jetons et découvrir
 * quels documents existent, avec leur titre et leur type.
 *
 * Durcissement :
 *   • rate limiting PERSISTANT par IP (store PostgreSQL partagé) ;
 *   • validation stricte de la forme du jeton AVANT toute requête SQL
 *     (rejette le bruit et les entrées surdimensionnées sans toucher la base) ;
 *   • réponse minimale et `Cache-Control: no-store` ;
 *   • aucune fuite d'erreur interne (500 générique JSON, sans stack trace).
 */

/** Forme attendue d'un jeton QR : base64url/UUID-like, borné en longueur. */
const QR_TOKEN_RE = /^[A-Za-z0-9_-]{6,128}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    /*
     * F-23 (re-pentest #2) - Le limiteur est FAIL-CLOSED mais DIFFERENCIE.
     *
     * Si le backend du limiteur est momentanement indisponible (ex. pooler
     * PostgreSQL sature -> EMAXCONNSESSION), on repond 503 Service Unavailable
     * + Retry-After : un signal honnete et exploitable par les clients, au lieu
     * de laisser l infrastructure produire un 500 opaque en cascade.
     *
     * On reste FAIL-CLOSED : la requete n est JAMAIS servie sans passer par le
     * limiteur, sinon l oracle d enumeration corrige en F-20 se rouvrirait.
     */
    let rl: WindowResult;
    try {
      await ensureRateLimitSchema();
      rl = await loginRateLimiter.checkEndpoint(clientIp(req), "verify-qr", SENSITIVE_ENDPOINT_LIMIT);
    } catch (limiterError) {
      console.error("[verify-qr] limiteur indisponible:", limiterError);
      return NextResponse.json(
        { error: "Service temporairement indisponible. Reessayez dans quelques instants." },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de requêtes. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    bindRequestEnvironment(req);
    const { token: rawToken } = await params;
    const token = String(rawToken ?? "").trim();
    if (!QR_TOKEN_RE.test(token)) {
      return NextResponse.json({ valid: false, result: "Token invalide" }, { status: 400 });
    }

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

    return NextResponse.json(
      { valid, type: row?.type, title: row?.title, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[verify-qr]", error);
    return internalErrorResponse(error);
  }
}
