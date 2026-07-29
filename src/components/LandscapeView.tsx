"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getMyPovIds } from "@/lib/mine";
import type { Landscape, LandscapePoint, LandscapeTension } from "@/lib/types";

/**
 * The landscape as a topic carousel: one topic per slide, its tensions
 * stacked inside. Arrows, dots, swipe, and arrow keys move between topics.
 * Each tension is a single clean axis: two ideas flanking a line, every
 * voice a dot between them. Hover or tap a dot to read the view; dots from
 * this browser are marked "you".
 */
export default function LandscapeView({
  landscape,
  focusPovId,
}: {
  landscape: Landscape;
  focusPovId: string | null;
}) {
  const [myIds, setMyIds] = useState<string[]>([]);

  useEffect(() => {
    setMyIds(getMyPovIds());
  }, []);

  const topics = landscape.topics;

  const focusTopicIndex = useMemo(() => {
    if (!focusPovId) return 0;
    const i = topics.findIndex((topic) =>
      topic.tensions.some((t) => t.points.some((p) => p.povId === focusPovId)),
    );
    return i === -1 ? 0 : i;
  }, [topics, focusPovId]);

  const [index, setIndex] = useState(focusTopicIndex);
  const count = topics.length;
  const go = (i: number) => setIndex(Math.max(0, Math.min(count - 1, i)));

  // Arrow keys move between topics.
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

  // Horizontal trackpad scrolling rotates the carousel. A short lock keeps
  // one continuous gesture from skipping several topics at once.
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

  const chevron = (dir: "left" | "right") => (
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

  return (
    <main className="min-h-0 flex-1">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-5">
        {/* Carousel controls */}
        <div className="flex items-center justify-between border-b border-line py-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Topic {index + 1} of {count}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label="Previous topic"
              className={arrowClass(index === 0)}
            >
              {chevron("left")}
            </button>
            <button
              onClick={() => go(index + 1)}
              disabled={index === count - 1}
              aria-label="Next topic"
              className={arrowClass(index === count - 1)}
            >
              {chevron("right")}
            </button>
            <Link
              href="/#starters"
              className="ml-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/85"
            >
              Add your view
            </Link>
          </div>
        </div>

        {/* Sliding topics */}
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
            {topics.map((topic, i) => (
              <section
                key={topic.id}
                inert={i !== index}
                aria-hidden={i !== index}
                className={
                  "flex h-full w-full shrink-0 flex-col overflow-y-auto pt-6 transition-opacity duration-500 " +
                  (i === index ? "opacity-100" : "opacity-0")
                }
              >
                <h2 className="font-display text-2xl leading-snug text-ink sm:text-3xl">
                  {topic.label}
                </h2>
                <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-6 py-4">
                  {topic.tensions.map((tension) => (
                    <TensionAxis
                      key={tension.id}
                      tension={tension}
                      myIds={myIds}
                      focusPovId={focusPovId}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 py-4">
          {topics.map((topic, i) => (
            <button
              key={topic.id}
              onClick={() => go(i)}
              aria-label={`Go to topic: ${topic.label}`}
              className={
                i === index
                  ? "h-2 w-6 rounded-full bg-ink transition-all duration-300"
                  : "h-2 w-2 rounded-full bg-ink/20 transition-all duration-300 hover:bg-ink/40"
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Tension axis                                                        */
/* ------------------------------------------------------------------ */

interface PlacedPoint {
  point: LandscapePoint;
  /** Horizontal position, 0..100 (% of axis width). */
  x: number;
  /** Vertical beeswarm offset in px from the axis line. */
  dy: number;
}

/**
 * Beeswarm layout: dots near the same score stack outward from the line
 * instead of jittering randomly, so the distribution reads at a glance.
 */
function layoutPoints(points: LandscapePoint[]): PlacedPoint[] {
  const sorted = [...points].sort((a, b) => a.score - b.score);
  const counts = new Map<number, number>();
  return sorted.map((point) => {
    const x = ((point.score + 1) / 2) * 100;
    const bin = Math.round(x / 5);
    const k = counts.get(bin) ?? 0;
    counts.set(bin, k + 1);
    const level = Math.ceil(k / 2);
    const dir = k % 2 === 1 ? -1 : 1;
    return { point, x, dy: dir * level * 13 };
  });
}

function TensionAxis({
  tension,
  myIds,
  focusPovId,
}: {
  tension: LandscapeTension;
  myIds: string[];
  focusPovId: string | null;
}) {
  const placed = useMemo(() => layoutPoints(tension.points), [tension.points]);
  const [pinnedId, setPinnedId] = useState<string | null>(
    focusPovId && tension.points.some((p) => p.povId === focusPovId)
      ? focusPovId
      : null,
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const shownId = hoveredId ?? pinnedId;
  const shown = placed.find((p) => p.point.povId === shownId) ?? null;

  return (
    <div>
      {/* The question at stake: the heading of this tension */}
      <h3 className="mx-auto max-w-2xl text-center font-display text-base leading-snug text-ink sm:text-lg">
        {tension.question}
      </h3>

      {/* Pole labels above the axis on small screens */}
      <div className="mt-4 flex items-baseline justify-between gap-6 sm:hidden">
        <span className="max-w-[45%] font-display text-sm leading-snug text-ink">
          {tension.poleA}
        </span>
        <span className="max-w-[45%] text-right font-display text-sm leading-snug text-ink">
          {tension.poleB}
        </span>
      </div>

      {/* Poles flanking the axis on larger screens */}
      <div className="flex items-center gap-4 sm:mt-2 sm:gap-8">
        <span className="hidden w-44 shrink-0 text-right font-display text-base leading-snug text-ink sm:block">
          {tension.poleA}
        </span>

        <div className="relative h-24 min-w-0 flex-1">
          {/* Axis line with soft ends */}
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-ink/40 via-line to-ink/40" />
          <div className="absolute left-0 top-1/2 h-3 w-px -translate-y-1/2 bg-ink/40" />
          <div className="absolute right-0 top-1/2 h-3 w-px -translate-y-1/2 bg-ink/40" />
          {/* Center tick */}
          <div className="absolute left-1/2 top-1/2 h-2 w-px -translate-y-1/2 bg-line" />

          {/* Dots */}
          {placed.map(({ point, x, dy }) => {
            const isMine = myIds.includes(point.povId);
            const isShown = shownId === point.povId;
            return (
              <button
                key={point.povId}
                onMouseEnter={() => setHoveredId(point.povId)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() =>
                  setPinnedId(pinnedId === point.povId ? null : point.povId)
                }
                aria-label="Read this point of view"
                className="absolute -translate-x-1/2 -translate-y-1/2 p-1"
                style={{
                  left: `${x}%`,
                  top: `calc(50% + ${dy}px)`,
                  zIndex: isMine || isShown ? 2 : 1,
                }}
              >
                <span
                  className={
                    isMine
                      ? "block h-3 w-3 rounded-full bg-ink ring-4 ring-ink/15 transition-transform duration-150" +
                        (isShown ? " scale-125" : "")
                      : isShown
                        ? "block h-2.5 w-2.5 scale-125 rounded-full bg-ink transition-transform duration-150"
                        : "block h-2.5 w-2.5 rounded-full bg-ink/20 transition-all duration-150 hover:bg-ink/50"
                  }
                />
                {isMine && (
                  <span className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider text-ink">
                    you
                  </span>
                )}
              </button>
            );
          })}

        </div>

        <span className="hidden w-44 shrink-0 font-display text-base leading-snug text-ink sm:block">
          {tension.poleB}
        </span>
      </div>

      {/* Reading area: a distinct panel describing the hovered or pinned view */}
      <div className="mx-auto min-h-24 max-w-2xl">
        {shown ? (
          <div className="rounded-[12px] border border-line bg-paper-2/50 px-5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
              {myIds.includes(shown.point.povId) ? "Your view" : "One voice"}
              {" · "}
              {Math.abs(shown.point.score) < 0.2
                ? "sits near the middle"
                : `${Math.abs(shown.point.score) >= 0.7 ? "firmly toward" : "leans toward"} “${shown.point.score < 0 ? tension.poleA : tension.poleB}”`}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {shown.point.summary}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
