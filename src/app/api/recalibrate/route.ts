import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { recalibrate } from "@/lib/analysis";
import { isAdminRequest } from "@/lib/adminAuth";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { ensureSeeded } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A full recalibration makes several analysis-model calls.
export const maxDuration = 60;

/** Manual recalibration trigger (admin only). Reclusters every view and re-derives tensions. */
export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limit = rateLimit(clientKey(req, "recalibrate"), 2, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "The landscape was recalibrated recently. Please wait a few minutes." },
      { status: 429 },
    );
  }

  await ensureSeeded();
  const result = await recalibrate();
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }
  // Recalibration reshapes the shared landscape shown on the cached pages.
  revalidatePath("/");
  revalidatePath("/landscape");
  return NextResponse.json(result);
}
