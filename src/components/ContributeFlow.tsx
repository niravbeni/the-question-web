"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { siteCopy } from "@/content/copy";
import { addMyPovId } from "@/lib/mine";
import LoadingDots from "@/components/LoadingDots";
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

const backClasses =
  "inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink disabled:opacity-40";

function BackChevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.5 3.5L5 8l4.5 4.5" />
    </svg>
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

  /**
   * Step back one question. The previous exchange is already in state, so this
   * drops the current question plus the answer that prompted it and puts that
   * answer back in the box. From the first question it returns to the opening.
   */
  function goBack() {
    if (busy) return;
    setError(null);
    const answeredCount = messages.filter((m) => m.role === "user").length - 1;
    if (answeredCount < 1) {
      setMessages([]);
      setAnswer("");
      setPhase("write");
      return;
    }
    const previousAnswer = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content;
    setMessages(messages.slice(0, -2));
    setAnswer(previousAnswer ?? "");
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

  // On the review step, Enter confirms even before the summary field is
  // focused, so it can be published straight from the keyboard without first
  // clicking into the text. While the field is focused its own handler owns
  // Enter (and Shift+Enter still makes a newline), so this only fills the gap.
  useEffect(() => {
    if (phase !== "review") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)
        return;
      e.preventDefault();
      if (!publishing && summary.trim()) void publish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // publish is stable enough for this step; re-bind when its guards change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, publishing, summary]);

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
      // A full document load, deliberately: the client router may hold a
      // prefetched landscape page from before this publish, which would show
      // the landscape without the view that was just added. The server has
      // just revalidated both pages, so a fresh load is guaranteed current.
      window.location.assign(`/landscape?pov=${data.povId}`);
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
        <div className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
          <Link href="/#starters" className={backClasses}>
            <BackChevron />
            Back
          </Link>
          <h1 className="mt-6 font-display text-3xl leading-snug text-ink sm:text-5xl">
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
          <div className="mt-8 inline-flex flex-col items-end">
            <button
              onClick={startChat}
              disabled={!continuation.trim()}
              className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-opacity hover:bg-ink/85 disabled:opacity-40"
            >
              Continue →
            </button>
            {continuation.trim() && (
              <div className="mt-2">
                <EnterHint />
              </div>
            )}
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

    return (
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
          <button
            type="button"
            onClick={goBack}
            disabled={busy}
            className={backClasses}
          >
            <BackChevron />
            Back
          </button>

          <h1 className="mt-6 min-h-[2.5rem] font-display text-3xl leading-snug text-ink sm:text-4xl">
            {currentQuestion || "…"}
          </h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendAnswer();
            }}
          >
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={submitOnEnter(sendAnswer)}
              placeholder="Answer in your own words…"
              rows={5}
              disabled={busy}
              className="mt-8 w-full resize-none rounded-[12px] border border-line bg-paper p-5 font-display text-xl leading-relaxed text-ink placeholder:text-muted focus:border-ink/40 disabled:opacity-60 sm:text-2xl"
            />
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
              <div className="inline-flex flex-col items-end">
                <button
                  type="submit"
                  disabled={busy || !answer.trim()}
                  className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-opacity hover:bg-ink/85 disabled:opacity-40"
                >
                  {busy ? "Listening…" : "Send →"}
                </button>
                {!busy && answer.trim() && (
                  <div className="mt-2">
                    <EnterHint />
                  </div>
                )}
              </div>
              {!busy && (
                <button
                  type="button"
                  onClick={skipToSummary}
                  className="py-3.5 text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
                >
                  I&apos;ve said what I need, go to my summary →
                </button>
              )}
            </div>
          </form>

          {error && <p className="mt-4 text-sm text-ink">{error}</p>}
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
          <div className="mt-6 inline-flex flex-col items-end">
            <button
              onClick={publish}
              disabled={publishing || !summary.trim()}
              className={
                "inline-flex items-center gap-2.5 rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-opacity hover:bg-ink/85 " +
                (publishing ? "cursor-wait" : "disabled:opacity-40")
              }
            >
              {publishing ? (
                <>
                  Publishing
                  <LoadingDots size="sm" />
                </>
              ) : (
                siteCopy.consent.publishButton
              )}
            </button>
            {!publishing && summary.trim() && (
              <div className="mt-2">
                <EnterHint />
              </div>
            )}
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
