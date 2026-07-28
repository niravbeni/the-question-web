import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import {
  deleteNonSeedPovs,
  deletePov,
  getAdminPovs,
  getPovById,
  updatePovText,
} from "@/lib/db";
import { ensureSeeded, resetToSeeds } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prototype admin endpoints for inspecting and editing the database.
 * Gated by the ADMIN_PASSWORD env var via the x-admin-key header.
 */

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  await ensureSeeded();
  return NextResponse.json({ povs: await getAdminPovs() });
}

export async function PATCH(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    summary?: string;
    rawInput?: string;
  } | null;
  if (!body?.id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  const existing = await getPovById(body.id);
  if (!existing) {
    return NextResponse.json({ error: "Unknown view." }, { status: 404 });
  }
  const summary = (body.summary ?? existing.summary).trim();
  const rawInput = (body.rawInput ?? existing.rawInput).trim();
  if (summary.length < 5) {
    return NextResponse.json({ error: "Summary is too short." }, { status: 400 });
  }
  await updatePovText(body.id, summary, rawInput);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    mode?: "one" | "test-data" | "reset-all";
  } | null;

  if (body?.mode === "test-data") {
    const removed = await deleteNonSeedPovs();
    return NextResponse.json({ ok: true, removed });
  }
  if (body?.mode === "reset-all") {
    await resetToSeeds();
    return NextResponse.json({ ok: true, reset: true });
  }
  if (body?.id) {
    await deletePov(body.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Missing id or mode." }, { status: 400 });
}
