import { NextResponse } from "next/server";
import { isRecalibrating } from "@/lib/analysis";
import { getLandscape } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  return NextResponse.json({
    landscape: await getLandscape(),
    recalibrating: isRecalibrating(),
  });
}
