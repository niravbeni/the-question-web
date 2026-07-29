"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMyPovIds } from "@/lib/mine";
import type { LandscapeTension, LandscapeTopic } from "@/lib/types";

/**
 * One topic, opened from the spider chart. Each of its tensions is a block:
 * a line between two opposing pulls, shaded where the voices actually gather,
 * with a dot for each third of the line and one for where you sit.
 */
export default function TopicTensions({
  topic,
  index,
  count,
  focusPovId,
}: {
  topic: LandscapeTopic;
  index: number;
  count: number;
  focusPovId: string | null;
}) {
  const myIds = useMyPovIds();

  const prev = index > 0 ? index - 1 : null;
  const next = index < count - 1 ? index + 1 : null;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-5">
        {/* Top bar */}
        <div className="grid grid-cols-3 items-center border-b border-line py-4">
          <Link
            href="/landscape"
            className="inline-flex items-center gap-1.5 justify-self-start text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <Chevron />
            All topics
          </Link>
          <p className="justify-self-center text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Topic {index + 1} of {count}
          </p>
          <Link
            href="/#starters"
            className="justify-self-end rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/85"
          >
            Add your view
          </Link>
        </div>

        <h1 className="pt-7 text-center font-display text-2xl leading-snug text-ink sm:pt-8 sm:text-3xl">
          {topic.label}
        </h1>

        {/* Tensions, one block each, parted by hairlines. The inner column is
            at least as tall as the space available, so a short topic centres
            its blocks and a long one scrolls instead of spilling over the
            heading and the footer. */}
        <div className="min-h-0 flex-1 overflow-y-auto py-6">
          <div className="flex min-h-full flex-col justify-center divide-y divide-line">
            {topic.tensions.length === 0 ? (
              <p className="text-center text-sm text-muted">
                No tensions have emerged in this topic yet.
              </p>
            ) : (
              topic.tensions.map((tension) => (
                <TensionBlock
                  key={tension.id}
                  tension={tension}
                  myIds={myIds}
                  focusPovId={focusPovId}
                />
              ))
            )}
          </div>
        </div>

        {/* Move between topics without going back out */}
        <div className="flex items-center justify-between border-t border-line py-4">
          <TopicStep to={prev} label="Previous topic" dir="left" />
          <TopicStep to={next} label="Next topic" dir="right" />
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* One tension                                                         */
/* ------------------------------------------------------------------ */

/** Where the thirds of the axis begin and end. */
const SECTION_EDGE = 1 / 3;
/** Buckets used to shade the line. */
const BINS = 26;
/** Neighbour bleed when smoothing the density, in bins. */
const SMOOTH = 1.6;

type SectionKey = "left" | "center" | "right";

/**
 * Density of voices along the axis, smoothed so a handful of views still reads
 * as a gradient rather than isolated stripes, and normalized so the busiest
 * stretch of every tension is equally legible.
 */
function density(scores: number[]): number[] {
  const bins = new Array<number>(BINS).fill(0);
  if (scores.length === 0) return bins;
  for (const score of scores) {
    const exact = ((score + 1) / 2) * (BINS - 1);
    for (let b = 0; b < BINS; b++) {
      const d = (b - exact) / SMOOTH;
      bins[b] += Math.exp(-0.5 * d * d);
    }
  }
  const max = Math.max(...bins);
  return max > 0 ? bins.map((b) => b / max) : bins;
}

function TensionBlock({
  tension,
  myIds,
  focusPovId,
}: {
  tension: LandscapeTension;
  myIds: string[];
  focusPovId: string | null;
}) {
  const mine = useMemo(
    () =>
      tension.points.find(
        (p) => p.povId === focusPovId || myIds.includes(p.povId),
      ) ?? null,
    [tension.points, myIds, focusPovId],
  );

  const heat = useMemo(
    () => density(tension.points.map((p) => p.score)),
    [tension.points],
  );

  const counts = useMemo(() => {
    const out: Record<SectionKey, number> = { left: 0, center: 0, right: 0 };
    for (const p of tension.points) {
      const key: SectionKey =
        p.score < -SECTION_EDGE ? "left" : p.score > SECTION_EDGE ? "right" : "center";
      out[key]++;
    }
    return out;
  }, [tension.points]);

  const [shown, setShown] = useState<SectionKey | "mine" | null>(null);

  const sectionText: Record<SectionKey, string | null> = {
    left: tension.sections.left,
    center: tension.sections.center,
    right: tension.sections.right,
  };
  const sectionLabel: Record<SectionKey, string> = {
    left: `Toward “${tension.poleA}”`,
    center: "Weighing both sides",
    right: `Toward “${tension.poleB}”`,
  };

  const panel =
    shown === "mine" && mine
      ? { label: "Your view", body: mine.summary }
      : shown && shown !== "mine"
        ? {
            label: sectionLabel[shown],
            body:
              sectionText[shown] ??
              (counts[shown] === 0
                ? "Nobody stands here yet."
                : "This side has not been summarized since the last recalibration."),
          }
        : null;

  return (
    <section className="py-6 sm:py-8">
      <h2 className="font-display text-lg leading-snug text-ink sm:text-xl">
        {tension.question}
      </h2>

      {/* Poles */}
      <div className="mt-3 flex items-baseline justify-between gap-6">
        <span className="max-w-[44%] font-display text-sm leading-snug text-ink">
          {tension.poleA}
        </span>
        <span className="max-w-[44%] text-right font-display text-sm leading-snug text-ink">
          {tension.poleB}
        </span>
      </div>

      {/* The line: quietly shaded where the voices gather */}
      <div className="relative mt-3 h-16">
        <div className="absolute inset-x-0 top-5 flex h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-line/50">
          {heat.map((value, i) => (
            <span
              key={i}
              className="h-full flex-1"
              style={{
                backgroundColor: `color-mix(in oklab, var(--color-ink) ${Math.round(
                  5 + value * 40,
                )}%, transparent)`,
              }}
            />
          ))}
        </div>

        {/* Three fixed dots: what each stretch of the line holds */}
        {(["left", "center", "right"] as SectionKey[]).map((key) => {
          const x = key === "left" ? 4 : key === "center" ? 50 : 96;
          const empty = counts[key] === 0;
          const active = shown === key;
          return (
            <button
              key={key}
              onMouseEnter={() => setShown(key)}
              onMouseLeave={() => setShown(null)}
              onClick={() => setShown(active ? null : key)}
              aria-label={sectionLabel[key]}
              className="absolute top-5 -translate-x-1/2 -translate-y-1/2 p-2"
              style={{ left: `${x}%`, zIndex: 2 }}
            >
              <span
                className={
                  "block h-3 w-3 rounded-full border transition-all duration-150 " +
                  (empty
                    ? "border-line bg-paper"
                    : active
                      ? "scale-110 border-ink bg-ink"
                      : "border-ink/70 bg-paper hover:bg-ink/15")
                }
              />
            </button>
          );
        })}

        {/* Where you sit, hung below the line so it never hides behind a dot */}
        {mine && (
          <button
            onMouseEnter={() => setShown("mine")}
            onMouseLeave={() => setShown(null)}
            onClick={() => setShown(shown === "mine" ? null : "mine")}
            aria-label="Read your view"
            className="absolute top-5 -translate-x-1/2 p-1"
            style={{
              // Inset from the ends so a score at either extreme stays whole
              // instead of being clipped by the edge of the line.
              left: `${(2 + ((mine.score + 1) / 2) * 96).toFixed(3)}%`,
              zIndex: 3,
            }}
          >
            <span className="mx-auto block h-2 w-px bg-ink/40" />
            <span
              className={
                "mx-auto block h-3 w-3 rounded-full bg-ink ring-4 ring-ink/15 transition-transform duration-150 " +
                (shown === "mine" ? "scale-125" : "")
              }
            />
            <span className="mt-0.5 block text-center text-[10px] font-semibold uppercase tracking-wider text-ink">
              you
            </span>
          </button>
        )}
      </div>

      {/* Reading line for whichever dot is being touched */}
      <div className="min-h-10 pt-1">
        {panel ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
              {panel.label}
            </span>
            <span className="mx-2 text-muted">·</span>
            {panel.body}
          </p>
        ) : (
          <p className="text-xs text-muted">
            Hover a dot to read what that stretch of the line holds.
          </p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function TopicStep({
  to,
  label,
  dir,
}: {
  to: number | null;
  label: string;
  dir: "left" | "right";
}) {
  if (to === null) {
    return <span className="text-sm text-muted/50">{label}</span>;
  }
  return (
    <Link
      href={`/landscape?topic=${to}`}
      className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
    >
      {dir === "left" && <Chevron />}
      {label}
      {dir === "right" && <Chevron flip />}
    </Link>
  );
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={flip ? "-scale-x-100" : undefined}
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
