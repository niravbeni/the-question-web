"use client";

import { useMemo, useState } from "react";
import { useMyPovIds } from "@/lib/mine";
import type { LandscapeTension, LandscapeTopic } from "@/lib/types";

/**
 * One topic as a slide of the topic carousel: its label, then each of its
 * tensions as a block: a line between two opposing pulls, shaded where the
 * voices actually gather, with a dot for each third of the line and one for
 * where you sit. The carousel owns the chrome around this, so the slide is
 * just the reading itself, kept to a narrow column so no line runs the full
 * width of the page.
 */
export default function TopicTensions({
  topic,
  focusPovId,
}: {
  topic: LandscapeTopic;
  focusPovId: string | null;
}) {
  const myIds = useMyPovIds();

  return (
    <div className="flex h-full flex-col px-5">
      <h1 className="pt-7 text-center font-display text-2xl leading-snug text-ink sm:pt-8 sm:text-3xl">
        {topic.label}
      </h1>

      {/* Tensions, one block each, parted by hairlines. The inner column is
          at least as tall as the space available, so a short topic centres its
          blocks and a long one scrolls instead of spilling over the chrome. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center divide-y divide-line">
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
    </div>
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

/**
 * The density as one smooth left-to-right gradient rather than a row of solid
 * bins, so the shading reads as a continuous wash. Each bin becomes a colour
 * stop and the browser interpolates between them. Positions are rounded so the
 * server and client render byte-identical strings and hydration stays quiet.
 */
function heatGradient(heat: number[]): string {
  if (heat.length < 2) return "none";
  const stops = heat.map((value, i) => {
    const pos = ((i / (heat.length - 1)) * 100).toFixed(2);
    const alpha = Math.round(5 + value * 40);
    return `color-mix(in oklab, var(--color-ink) ${alpha}%, transparent) ${pos}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
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
    <section className="py-8 sm:py-10">
      <h2 className="font-display text-lg leading-snug text-ink sm:text-xl">
        {tension.question}
      </h2>

      {/* Poles */}
      <div className="mt-9 flex items-baseline justify-between gap-6">
        <span className="max-w-[44%] font-display text-sm leading-snug text-ink">
          {tension.poleA}
        </span>
        <span className="max-w-[44%] text-right font-display text-sm leading-snug text-ink">
          {tension.poleB}
        </span>
      </div>

      {/* The line: quietly shaded where the voices gather */}
      <div className="relative mt-3 h-16">
        <div
          className="absolute inset-x-0 top-5 h-1.5 -translate-y-1/2 rounded-full bg-line/50"
          style={{ backgroundImage: heatGradient(heat) }}
        />

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

        {/* Where you sit, marked on the line itself. The ring keeps it legible
            even where it meets one of the section dots, and the label hangs
            just below without nudging the dot off the line. */}
        {mine && (
          <button
            onMouseEnter={() => setShown("mine")}
            onMouseLeave={() => setShown(null)}
            onClick={() => setShown(shown === "mine" ? null : "mine")}
            aria-label="Read your view"
            className="absolute top-5 -translate-x-1/2 -translate-y-1/2 p-1"
            style={{
              // Inset from the ends so a score at either extreme stays whole
              // instead of being clipped by the edge of the line.
              left: `${(2 + ((mine.score + 1) / 2) * 96).toFixed(3)}%`,
              zIndex: 3,
            }}
          >
            <span
              className={
                "block h-3 w-3 rounded-full bg-ink ring-4 ring-ink/15 transition-transform duration-150 " +
                (shown === "mine" ? "scale-125" : "")
              }
            />
            <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider text-ink">
              you
            </span>
          </button>
        )}
      </div>

      {/* Reading line for whichever dot is being touched. Held at a fixed
          height with the text laid over it, so hovering a dot swaps the words
          in place without nudging anything below it. */}
      <div className="relative h-10">
        {panel ? (
          <p className="absolute inset-x-0 top-1 text-sm leading-relaxed text-ink-soft">
            {panel.body}
          </p>
        ) : (
          <p className="absolute inset-x-0 top-1 text-xs text-muted">
            Hover a dot to read what that stretch of the line holds.
          </p>
        )}
      </div>
    </section>
  );
}
