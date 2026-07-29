"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMyPovIds } from "@/lib/mine";
import type { Landscape, LandscapePoint, LandscapeTension } from "@/lib/types";

/**
 * The landscape, one topic at a time: a selector across the top, the active
 * topic's tensions stacked below. Each tension is a single clean axis: two
 * ideas flanking a line, every voice a dot between them. Hover or tap a dot
 * to read the view; dots from this browser are marked "you".
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

  const focusTopicId = useMemo(() => {
    if (!focusPovId) return null;
    for (const topic of landscape.topics) {
      for (const tension of topic.tensions) {
        if (tension.points.some((p) => p.povId === focusPovId)) return topic.id;
      }
    }
    return null;
  }, [landscape, focusPovId]);

  const [activeId, setActiveId] = useState<string | null>(
    focusTopicId ?? landscape.topics[0]?.id ?? null,
  );
  const active =
    landscape.topics.find((t) => t.id === activeId) ?? landscape.topics[0];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-5 py-14 sm:py-18">
        {/* Heading */}
        <h1 className="max-w-3xl font-display text-3xl leading-tight text-ink sm:text-5xl">
          Where people stand on women&apos;s health and AI.
        </h1>

        {/* Topic selector */}
        <div className="mt-10 flex flex-wrap gap-2">
          {landscape.topics.map((topic) => {
            const isActive = topic.id === active?.id;
            return (
              <button
                key={topic.id}
                onClick={() => setActiveId(topic.id)}
                className={
                  isActive
                    ? "rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
                    : "rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
                }
              >
                {topic.label}
                <span
                  className={isActive ? "ml-2 text-paper/60" : "ml-2 text-muted"}
                >
                  {topic.voiceCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active topic */}
        {active && (
          <section key={active.id} className="mt-14">
            <p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
              {active.summary}
            </p>
            <div className="mt-12 space-y-14">
              {active.tensions.map((tension) => (
                <TensionAxis
                  key={tension.id}
                  tension={tension}
                  myIds={myIds}
                  focusPovId={focusPovId}
                />
              ))}
            </div>
          </section>
        )}

        {/* Footer actions */}
        <div className="mt-16 border-t border-line pt-8">
          <Link
            href="/#starters"
            className="inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-ink/85"
          >
            Add your view
          </Link>
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
      <h3 className="mx-auto max-w-2xl text-center font-display text-lg leading-snug text-ink sm:text-xl">
        {tension.question}
      </h3>

      {/* Pole labels above the axis on small screens */}
      <div className="mt-6 flex items-baseline justify-between gap-6 sm:hidden">
        <span className="max-w-[45%] font-display text-sm leading-snug text-ink">
          {tension.poleA}
        </span>
        <span className="max-w-[45%] text-right font-display text-sm leading-snug text-ink">
          {tension.poleB}
        </span>
      </div>

      {/* Poles flanking the axis on larger screens */}
      <div className="flex items-center gap-4 sm:mt-8 sm:gap-8">
        <span className="hidden w-44 shrink-0 text-right font-display text-lg leading-snug text-ink sm:block">
          {tension.poleA}
        </span>

        <div className="relative h-28 min-w-0 flex-1">
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

        <span className="hidden w-44 shrink-0 font-display text-lg leading-snug text-ink sm:block">
          {tension.poleB}
        </span>
      </div>

      {/* Reading area: a distinct panel describing the hovered or pinned view */}
      <div className="mx-auto mt-2 min-h-28 max-w-2xl">
        {shown ? (
          <div className="rounded-[12px] border border-line bg-paper-2/50 px-5 py-4 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
              {myIds.includes(shown.point.povId) ? "Your view" : "One voice"}
              {" · "}
              {Math.abs(shown.point.score) < 0.2
                ? "sits near the middle"
                : `${Math.abs(shown.point.score) >= 0.7 ? "firmly toward" : "leans toward"} “${shown.point.score < 0 ? tension.poleA : tension.poleB}”`}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {shown.point.summary}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
