import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminRequest } from "@/lib/adminAuth";
import { getStarters, getStarterById, resetStarters, updateStarter } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin endpoints for the finish-the-sentence starters. The hand-written
 * copies in src/content/starters.ts are defaults; the database rows edited
 * here are what the live site shows. Gated by ADMIN_PASSWORD.
 */

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json({ starters: await getStarters() });
}

export async function PATCH(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    text?: string;
    shortLabel?: string;
    placeholder?: string;
  } | null;
  if (!body?.id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  const existing = await getStarterById(body.id);
  if (!existing) {
    return NextResponse.json({ error: "Unknown starter." }, { status: 404 });
  }
  const text = (body.text ?? existing.text).trim();
  const shortLabel = (body.shortLabel ?? existing.shortLabel).trim();
  const placeholder = (body.placeholder ?? existing.placeholder).trim();
  if (!text || text.length > 300) {
    return NextResponse.json(
      { error: "The sentence text must be between 1 and 300 characters." },
      { status: 400 },
    );
  }
  if (!shortLabel || shortLabel.length > 60) {
    return NextResponse.json(
      { error: "The short label must be between 1 and 60 characters." },
      { status: 400 },
    );
  }
  await updateStarter(body.id, { text, shortLabel, placeholder });
  // Drop the cached static render so the edited sentence shows on the next load.
  revalidatePath(`/contribute/${body.id}`);
  // The home page lists the starters too, so refresh its cached snapshot.
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

/** Restore all starters to the hand-written defaults. */
export async function DELETE(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  await resetStarters();
  // A reset touches every starter, so clear all the cached contribute pages.
  revalidatePath("/contribute/[starterId]", "page");
  // The home page lists the starters too, so refresh its cached snapshot.
  revalidatePath("/");
  return NextResponse.json({ ok: true, reset: true });
}
