"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { siteCopy } from "@/content/copy";
import { addMyPovId } from "@/lib/mine";
import type { ChatMessage, SentenceStarter } from "@/lib/types";

type Phase = "write" | "chat" | "review" | "published";

/** Small "press Enter ↵" affordance shown next to a submit button. */
function EnterHint() {
  return (
    <span className="hidden items-center gap-1 text-xs text-muted sm:inline-flex">
      press <span className="font-medium text-ink">Enter</span>
      <span aria-hidden>↵</span>
    </span>
  );
}

/** Submit on Enter, keep Shift+Enter for a newline. */
function submitOnEnter(submit: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
}

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
  const [showHistory, setShowHistory] = useState(false);
  const finalizedRef = useRef(false);

  const fullOpening = `${starter.text.replace(/…\s*$/, "")}… ${continuation.trim()}`;

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
        body: JSON.stringify({
          starterId: starter.id,
          messages: nextMessages,
          forceFinalize,
        }),
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

  /** Skip any remaining questions and go straight to the summary. */
  function skipToSummary() {
    if (busy) return;
    const text = answer.trim();
    setAnswer("");
    const next: ChatMessage[] = text
      ? [...messages, { role: "user", content: text }]
      : messages;
    setMessages(next);
    void runExchange(next, true);
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
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
          <h1 className="font-display text-3xl leading-snug text-ink sm:text-5xl">
            {starter.text}
          </h1>
          <textarea
            autoFocus
            value={continuation}
            onChange={(e) => setContinuation(e.target.value)}
            onKeyDown={submitOnEnter(startChat)}
            placeholder={starter.placeholder}
            rows={5}
            className="mt-8 w-full resize-none rounded-[12px] border border-line bg-paper p-5 font-display text-xl leading-relaxed text-ink placeholder:text-muted focus:border-ink/40 sm:text-2xl"
          />
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={startChat}
              disabled={!continuation.trim()}
              className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-opacity hover:bg-ink/85 disabled:opacity-40"
            >
              Continue →
            </button>
            {continuation.trim() && <EnterHint />}
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
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-5 pt-8 pb-8">
          {/* Everything said so far, tucked behind a toggle */}
          <div className="border-b border-line pb-4">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
            >
              {showHistory ? "Hide what you've said" : "See what you've said so far"}
              <svg
                viewBox="0 0 16 16"
                className={`h-3.5 w-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {showHistory && (
              <div className="mt-4 space-y-3">
                <p className="font-display text-lg leading-relaxed text-ink-soft">
                  {fullOpening}
                </p>
                {answered > 0 && (
                  <ul className="space-y-1.5">
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
              </div>
            )}
          </div>

          {/* Current question, big */}
          <div className="mt-8">
            <p className="min-h-[2.5rem] font-display text-2xl leading-snug text-ink sm:text-3xl">
              {currentQuestion || "…"}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendAnswer();
            }}
            className="mt-6 flex min-h-0 flex-1 flex-col"
          >
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={submitOnEnter(sendAnswer)}
              placeholder="Answer in your own words…"
              disabled={busy}
              className="min-h-24 w-full flex-1 resize-none rounded-[12px] border border-line bg-paper p-4 text-base leading-relaxed text-ink placeholder:text-muted focus:border-ink/40 disabled:opacity-60"
            />
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={busy || !answer.trim()}
                  className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-40"
                >
                  {busy ? "Listening…" : "Send"}
                </button>
                {!busy && answer.trim() && <EnterHint />}
              </div>
              {!busy && (
                <button
                  type="button"
                  onClick={skipToSummary}
                  className="py-3 text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
                >
                  I&apos;ve said what I need, go to my summary →
                </button>
              )}
            </div>
          </form>

          {error && <p className="mt-3 text-sm text-ink">{error}</p>}
        </div>
      </main>
    );
  }

  /* ---------- phase: review ---------- */
  if (phase === "review") {
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
          <h1 className="font-display text-2xl text-ink sm:text-3xl">
            Does this say what you mean?
          </h1>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onKeyDown={submitOnEnter(() => {
              if (!publishing && summary.trim()) void publish();
            })}
            rows={4}
            className="mt-6 w-full resize-none rounded-[12px] border border-line bg-paper p-5 font-display text-xl leading-relaxed text-ink focus:border-ink/40 sm:text-2xl"
          />
          <p className="mt-5 max-w-2xl text-xs leading-relaxed text-muted">
            {siteCopy.consent.text}
          </p>
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={publish}
              disabled={publishing || !summary.trim()}
              className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-40"
            >
              {publishing ? "Publishing…" : siteCopy.consent.publishButton}
            </button>
            {!publishing && summary.trim() && <EnterHint />}
          </div>
          {error && <p className="mt-4 text-sm text-ink">{error}</p>}
        </div>
      </main>
    );
  }

  /* ---------- phase: published ---------- */
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-5 py-24 text-center">
        <h1 className="font-display text-3xl text-ink">Your view is on the landscape.</h1>
      </div>
    </main>
  );
}
