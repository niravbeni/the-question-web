"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SpiderView from "@/components/SpiderView";
import type { Landscape } from "@/lib/types";

/**
 * The landscape overview as a two-slide carousel: the spider chart and a grid
 * of the same topics. Both are ways of reading one landscape, so they live
 * side by side and you can swipe, arrow, or tap between them. Each way in leads
 * to the same place: a topic's tensions.
 */
const SLIDES = ["Spider chart", "Topic grid"] as const;

export default function LandscapeOverview({
  landscape,
  focusPovId,
}: {
  landscape: Landscape;
  focusPovId: string | null;
}) {
  const [index, setIndex] = useState(0);
  const count = SLIDES.length;
  const go = (i: number) => setIndex(Math.max(0, Math.min(count - 1, i)));

  // Arrow keys move between slides.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(count - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  // Basic swipe support.
  const touchX = useRef<number | null>(null);

  // Horizontal trackpad scrolling rotates the carousel. A short lock keeps one
  // continuous gesture from skipping several slides at once.
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let accum = 0;
    let locked = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (locked) return;
      accum += e.deltaX;
      if (Math.abs(accum) > 60) {
        const dir = accum > 0 ? 1 : -1;
        setIndex((i) => Math.max(0, Math.min(count - 1, i + dir)));
        accum = 0;
        locked = true;
        setTimeout(() => {
          locked = false;
        }, 550);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [count]);

  const arrowClass = (disabled: boolean) =>
    "flex h-10 w-10 items-center justify-center rounded-full border transition-colors " +
    (disabled
      ? "border-line text-muted/50"
      : "border-line text-ink hover:border-ink/40");

  return (
    <main className="min-h-0 flex-1">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-5">
        {/* Top bar: way back, which view, and the way in */}
        <div className="grid grid-cols-3 items-center border-b border-line py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 justify-self-start text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <Chevron dir="left" />
            Back
          </Link>
          <p className="justify-self-center text-xs font-medium uppercase tracking-[0.14em] text-muted">
            {SLIDES[index]}
          </p>
          <Link
            href="/#starters"
            className="justify-self-end rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/85"
          >
            Add your view
          </Link>
        </div>

        {/* Sliding views */}
        <div
          ref={trackRef}
          className="min-h-0 flex-1 overflow-hidden overscroll-x-contain"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
          }}
        >
          <div
            className="flex h-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            <section
              inert={index !== 0}
              aria-hidden={index !== 0}
              className={
                "h-full w-full shrink-0 overflow-hidden transition-opacity duration-500 " +
                (index === 0 ? "opacity-100" : "opacity-0")
              }
            >
              <SpiderView landscape={landscape} focusPovId={focusPovId} />
            </section>
            <section
              inert={index !== 1}
              aria-hidden={index !== 1}
              className={
                "h-full w-full shrink-0 overflow-hidden transition-opacity duration-500 " +
                (index === 1 ? "opacity-100" : "opacity-0")
              }
            >
              <TopicGrid landscape={landscape} />
            </section>
          </div>
        </div>

        {/* Bottom bar: arrows in the corners, dots in the middle */}
        <div className="flex items-center justify-between py-5">
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous view"
            className={arrowClass(index === 0)}
          >
            <Chevron dir="left" />
          </button>
          <div className="flex gap-2">
            {SLIDES.map((label, i) => (
              <button
                key={label}
                onClick={() => go(i)}
                aria-label={`Show ${label}`}
                className={
                  i === index
                    ? "h-2 w-6 rounded-full bg-ink transition-all duration-300"
                    : "h-2 w-2 rounded-full bg-ink/20 transition-all duration-300 hover:bg-ink/40"
                }
              />
            ))}
          </div>
          <button
            onClick={() => go(index + 1)}
            disabled={index === count - 1}
            aria-label="Next view"
            className={arrowClass(index === count - 1)}
          >
            <Chevron dir="right" />
          </button>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Topic grid                                                          */
/* ------------------------------------------------------------------ */

/**
 * The same topics as the spider chart's corners, laid out as blocks. Each is a
 * way into that topic's tensions; together they read like a contents page.
 */
function TopicGrid({ landscape }: { landscape: Landscape }) {
  const topics = landscape.topics;

  if (topics.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="max-w-sm text-center font-display text-xl leading-snug text-ink-soft">
          The landscape is still forming. Add the first views and topics will
          emerge.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-6">
      <div className="grid min-h-full grid-cols-1 content-center gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic, i) => (
          <Link
            key={topic.id}
            href={`/landscape?topic=${i}`}
            className="group flex flex-col rounded-[14px] border border-line bg-paper px-5 py-4 transition-colors hover:border-ink/40"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                {topic.voiceCount} {topic.voiceCount === 1 ? "voice" : "voices"}
              </span>
            </div>
            <h2 className="mt-2 font-display text-lg leading-snug text-ink underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover:decoration-ink">
              {topic.label}
            </h2>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">
              {topic.summary}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={dir === "right" ? "-scale-x-100" : undefined}
    >
      <path
        d="M9.5 3.5 5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
