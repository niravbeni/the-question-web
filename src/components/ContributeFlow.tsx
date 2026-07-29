"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { siteCopy } from "@/content/copy";
import { addMyPovId } from "@/lib/mine";
import type { ChatMessage, SentenceStarter } from "@/lib/types";

const MAX_QUESTIONS = 3;

type Phase = "write" | "chat" | "review" | "published";

interface StreamEvent {
  type: "text" | "finalize" | "error" | "done";
  value?: string;
  summary?: string;
}

/**
 * The finite contribution flow: continue the sentence (write), answer up to
 * three follow-up questions (chat), approve the anonymous summary (review),
 * publish, and get sent to your place on the landscape.
 */
export default function ContributeFlow({ starter }: { starter: SentenceStarter }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("write");
  const [continuation, setContinuation] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [answer, setAnswer] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalizedRef = useRef(false);

  const fullOpening = `${starter.text.replace(/…\s*$/, "")}… ${continuation.trim()}`;
  const questionsAsked = messages.filter((m) => m.role === "assistant").length;

  async function runExchange(nextMessages: ChatMessage[], forceFinalize = false) {
    setBusy(true);
    setError(null);
    setStreamingText("");
    finalizedRef.current = false;
    let acc = "";
    try {
      const res = await fetch("/api/pov/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starterId: starter.id, messages: nextMessages, forceFinalize }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "The facilitator is unavailable.",
        );
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: StreamEvent;
          try {
            ev = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }
          if (ev.type === "text" && ev.value) {
            acc += ev.value;
            setStreamingText(acc);
          } else if (ev.type === "finalize" && ev.summary) {
            finalizedRef.current = true;
            setSummary(ev.summary);
          } else if (ev.type === "error") {
            throw new Error(ev.value ?? "Something interrupted the exchange.");
          }
        }
      }

      const finalMessages: ChatMessage[] = acc.trim()
        ? [...nextMessages, { role: "assistant", content: acc.trim() }]
        : nextMessages;
      setMessages(finalMessages);
      setStreamingText("");
      if (finalizedRef.current) {
        setPhase("review");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function startChat() {
    if (!continuation.trim()) return;
    const opening: ChatMessage[] = [{ role: "user", content: fullOpening }];
    setMessages(opening);
    setPhase("chat");
    void runExchange(opening);
  }

  function sendAnswer() {
    const text = answer.trim();
    if (!text || busy) return;
    setAnswer("");
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    void runExchange(next);
  }

  function skipToSummary() {
    if (busy) return;
    void runExchange(messages, true);
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/pov", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          starterId: starter.id,
          rawInput: fullOpening,
          summary: summary.trim(),
          transcript: messages,
        }),
      });
      const data = (await res.json()) as { povId?: string; error?: string };
      if (!res.ok || !data.povId) {
        throw new Error(data.error ?? "Publishing failed. Please try again.");
      }
      addMyPovId(data.povId);
      setPhase("published");
      router.push(`/landscape?pov=${data.povId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publishing failed.");
    } finally {
      setPublishing(false);
    }
  }

  /* ---------- phase: write ---------- */
  if (phase === "write") {
    return (
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Your point of view · {starter.shortLabel}
          </p>
          <h1 className="mt-5 font-display text-3xl leading-snug text-ink sm:text-5xl">
            {starter.text}
          </h1>
          <textarea
            autoFocus
            value={continuation}
            onChange={(e) => setContinuation(e.target.value)}
            placeholder={starter.placeholder}
            rows={5}
            className="mt-8 w-full resize-none rounded-[12px] border border-line bg-paper p-5 font-display text-xl leading-relaxed text-ink placeholder:text-muted focus:border-ink/40 sm:text-2xl"
          />
          <p className="mt-3 text-xs text-muted">{starter.hint}</p>
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={startChat}
              disabled={!continuation.trim()}
              className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-opacity hover:bg-ink/85 disabled:opacity-40"
            >
              Continue →
            </button>
            <p className="text-xs text-muted">
              Next: up to {MAX_QUESTIONS} short questions, then you approve a summary.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- phase: chat ---------- */
  if (phase === "chat") {
    const currentQuestion =
      streamingText ||
      [...messages].reverse().find((m) => m.role === "assistant")?.content ||
      "";
    const answered = messages.filter((m) => m.role === "user").length - 1;

    return (
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
          {/* Your opening stays visible the whole time */}
          <div className="rounded-[12px] border border-line bg-paper-2/60 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Your opening
            </p>
            <p className="mt-2 font-display text-lg leading-relaxed text-ink">
              {fullOpening}
            </p>
          </div>

          {/* Earlier answers, compact */}
          {answered > 0 && (
            <ul className="mt-6 space-y-2">
              {messages.slice(1).map((m, i) =>
                m.role === "user" ? (
                  <li key={i} className="text-sm leading-relaxed text-ink-soft">
                    <span className="text-muted">You added: </span>
                    {m.content}
                  </li>
                ) : null,
              )}
            </ul>
          )}

          {/* Current question, big */}
          <div className="mt-10">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Question {Math.min(questionsAsked + (streamingText ? 1 : 0) || 1, MAX_QUESTIONS)} of {MAX_QUESTIONS}
            </p>
            <p className="mt-3 min-h-[2.5rem] font-display text-2xl leading-snug text-ink sm:text-3xl">
              {currentQuestion || "…"}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendAnswer();
            }}
            className="mt-8"
          >
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendAnswer();
                }
              }}
              placeholder="Answer in your own words…"
              rows={3}
              disabled={busy}
              className="w-full resize-none rounded-[12px] border border-line bg-paper p-4 text-base leading-relaxed text-ink placeholder:text-muted focus:border-ink/40 disabled:opacity-60"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                disabled={busy || !answer.trim()}
                className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-40"
              >
                {busy ? "Listening…" : "Send"}
              </button>
              <button
                type="button"
                onClick={skipToSummary}
                disabled={busy}
                className="rounded-full border border-line px-5 py-2.5 text-xs font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
              >
                I&apos;ve said what I wanted — summarize now
              </button>
            </div>
          </form>

          {error && <p className="mt-4 text-sm text-ink">{error}</p>}
          <p className="mt-8 text-xs text-muted">
            No personal medical details needed. The conversation stays private — only
            the summary you approve is published.
          </p>
        </div>
      </main>
    );
  }

  /* ---------- phase: review ---------- */
  if (phase === "review") {
    return (
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Your point of view, in one breath
          </p>
          <h1 className="mt-4 font-display text-2xl text-ink sm:text-3xl">
            Does this say what you mean?
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Edit it freely — these are the exact words that will appear on the
            landscape, anonymously.
          </p>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="mt-6 w-full resize-none rounded-[12px] border border-line bg-paper p-5 font-display text-xl leading-relaxed text-ink focus:border-ink/40 sm:text-2xl"
          />
          <p className="mt-5 max-w-2xl text-xs leading-relaxed text-muted">
            {siteCopy.consent.text}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              onClick={publish}
              disabled={publishing || !summary.trim()}
              className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-40"
            >
              {publishing ? "Publishing…" : siteCopy.consent.publishButton}
            </button>
            <button
              onClick={() => setPhase("chat")}
              disabled={publishing}
              className="rounded-full border border-line px-5 py-2.5 text-xs font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
            >
              ← Keep talking instead
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-ink">{error}</p>}
        </div>
      </main>
    );
  }

  /* ---------- phase: published ---------- */
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-4xl px-5 py-24 text-center">
        <h1 className="font-display text-3xl text-ink">Your view is on the landscape.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          Taking you to where you stand among everyone else…
        </p>
      </div>
    </main>
  );
}
