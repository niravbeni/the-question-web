import { randomUUID } from "node:crypto";
import { NextResponse, after } from "next/server";
import { getStarter } from "@/content/starters";
import { maybeAutoRecalibrate, placeNewPov } from "@/lib/analysis";
import { getPovById, insertPov, setPovEmbedding } from "@/lib/db";
import { embedText } from "@/lib/embeddings";
import { getOpenAI } from "@/lib/openai";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { ensureSeeded } from "@/lib/seed";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Publishing can trigger a background recalibration (several model calls).
export const maxDuration = 60;

interface PublishBody {
  starterId: string;
  rawInput: string;
  summary: string;
  transcript?: ChatMessage[];
}

export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req, "pov-publish"), 5, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You have published several views recently. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: PublishBody;
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const starter = getStarter(body.starterId);
  if (!starter) {
    return NextResponse.json({ error: "Unknown sentence starter." }, { status: 400 });
  }
  const rawInput = (body.rawInput ?? "").trim();
  const summary = (body.summary ?? "").trim();
  if (rawInput.length < 20 || rawInput.length > 4000) {
    return NextResponse.json(
      { error: "Your opening should be at least a couple of sentences." },
      { status: 400 },
    );
  }
  if (summary.length < 20 || summary.length > 800) {
    return NextResponse.json(
      { error: "The summary should be one to three sentences." },
      { status: 400 },
    );
  }

  // Moderation gate — only when a key is configured.
  const openai = getOpenAI();
  if (openai) {
    try {
      const mod = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: `${rawInput}\n\n${summary}`,
      });
      if (mod.results[0]?.flagged) {
        return NextResponse.json(
          {
            error:
              "This view could not be published as written. Please rephrase and try again.",
          },
          { status: 422 },
        );
      }
    } catch (err) {
      console.error("moderation failed, continuing", err);
    }
  }

  await ensureSeeded();

  const id = randomUUID();
  await insertPov({
    id,
    starterId: starter.id,
    rawInput,
    transcript: (body.transcript ?? []).slice(0, 20),
    summary,
    embedding: null,
    topicId: null,
    isSeed: false,
  });

  // Embed for future recalibrations (best effort).
  try {
    const emb = await embedText(`${summary}\n\n${rawInput}`);
    if (emb) await setPovEmbedding(id, emb);
  } catch (err) {
    console.error("embedding failed, continuing", err);
  }

  // Immediate placement into the current landscape.
  const pov = await getPovById(id);
  let topicId: string | null = null;
  if (pov) {
    try {
      const placement = await placeNewPov(pov);
      topicId = placement.topicId;
    } catch (err) {
      console.error("placement failed, view stays unplaced until recalibration", err);
    }
  }

  // If enough new voices have accumulated, recalibrate after the response is
  // sent — `after` keeps the serverless function alive for the work.
  after(async () => {
    await maybeAutoRecalibrate();
  });

  return NextResponse.json({ povId: id, topicId });
}
