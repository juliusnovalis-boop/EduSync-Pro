import { NextResponse } from "next/server";

/**
 * Catch-all API (pentest F-14) : toute route /api/* inconnue doit renvoyer un
 * 404 JSON — jamais le shell SPA (l'ancien comportement était 200 + HTML).
 */
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  return GET();
}

export async function PUT() {
  return GET();
}

export async function PATCH() {
  return GET();
}

export async function DELETE() {
  return GET();
}
