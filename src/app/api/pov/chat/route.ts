import { NextResponse } from "next/server";
import type OpenAI from "openai";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { buildFacilitatorPrompt, MAX_FOLLOW_UPS } from "@/lib/prompt";
import { chatTools } from "@/lib/tools";
import { getStarter } from "@/content/starters";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  starterId: string;
  /** messages[0] is the visitor's opening paragraph. */
  messages: ChatMessage[];
  /** True when the visitor pressed "skip to my summary". */
  forceFinalize?: boolean;
}

function encodeLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

/** Scripted exchange used when no API key is configured, so the flow demos offline. */
const OFFLINE_QUESTIONS = [
  "What experience or observation makes you feel this most strongly?",
  "If the people building these systems took your view seriously, what would they do differently?",
  "What would you accept giving up, if anything, to get that?",
];

export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req, "pov-chat"), 40, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You are sending messages quickly. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const starter = getStarter(body.starterId);
  if (!starter) {
    return NextResponse.json({ error: "Unknown sentence starter." }, { status: 400 });
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 || messages[0].role !== "user") {
    return NextResponse.json({ error: "Missing opening paragraph." }, { status: 400 });
  }

  const followUpsAsked = messages.filter((m) => m.role === "assistant").length;
  const mustFinalize = Boolean(body.forceFinalize) || followUpsAsked >= MAX_FOLLOW_UPS;

  const openai = getOpenAI();
  if (!openai) {
    return offlineResponse(messages, followUpsAsked, mustFinalize);
  }

  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildFacilitatorPrompt(starter, followUpsAsked) },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  if (mustFinalize) {
    chatMessages.push({
      role: "system",
      content:
        "The exchange is over. Call finalize_pov now with the best summary you can produce from everything above. Do not ask anything further.",
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (obj: unknown) => controller.enqueue(encodeLine(obj));
      try {
        const completion = await openai.chat.completions.create({
          model: CHAT_MODEL,
          messages: chatMessages,
          stream: true,
          // GPT-5.6 requires effort "none" to combine function tools with
          // chat completions: which also keeps the facilitator snappy.
          reasoning_effort: "none",
          tools: chatTools,
          tool_choice: mustFinalize
            ? { type: "function", function: { name: "finalize_pov" } }
            : "auto",
        });

        let text = "";
        let toolArgs = "";
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            text += delta.content;
            push({ type: "text", value: delta.content });
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.function?.arguments) toolArgs += tc.function.arguments;
            }
          }
        }

        if (toolArgs) {
          let summary = "";
          try {
            summary = String(
              (JSON.parse(toolArgs) as { summary?: string }).summary ?? "",
            ).trim();
          } catch {
            summary = "";
          }
          if (summary) {
            if (text.trim() === "") {
              push({
                type: "text",
                value: "Here is your point of view, ready to review below.",
              });
            }
            push({ type: "finalize", summary });
          }
        }

        push({ type: "done" });
      } catch (err) {
        console.error("pov chat stream error", err);
        push({
          type: "error",
          value: "Something interrupted the exchange. Try sending again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return ndjson(stream);
}

function offlineResponse(
  messages: ChatMessage[],
  followUpsAsked: number,
  mustFinalize: boolean,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (obj: unknown) => controller.enqueue(encodeLine(obj));
      if (!mustFinalize && followUpsAsked < OFFLINE_QUESTIONS.length) {
        push({ type: "text", value: OFFLINE_QUESTIONS[followUpsAsked] });
      } else {
        const opening = messages[0].content.trim().replace(/\s+/g, " ");
        const clipped = opening.length > 280 ? opening.slice(0, 277) + "…" : opening;
        push({
          type: "text",
          value: "Here is your point of view, ready to review below.",
        });
        push({ type: "finalize", summary: clipped });
      }
      push({ type: "done" });
      controller.close();
    },
  });
  return ndjson(stream);
}

function ndjson(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
