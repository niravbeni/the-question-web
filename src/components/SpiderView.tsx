"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Landscape } from "@/lib/types";

/**
 * The whole landscape as one stats shape, like a player's attributes in a
 * sports game. Each corner is a topic; the filled web reaches further toward
 * the topics more people have spoken to, so its lopsidedness is the shape of
 * the crowd's attention: which themes pull the most views. Corners are the way
 * in: each is a clear, clickable node that opens that topic's tensions.
 * Rendered as a slide of the landscape carousel, so it carries no chrome.
 */
export default function SpiderView({ landscape }: { landscape: Landscape }) {
  if (landscape.topics.length === 0) {
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
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center py-2">
        <Chart landscape={landscape} />
      </div>

      {/* Below the chart: on wider screens the corners carry their own labels,
          so this is just a one-line explanation. On a phone the corners show
          only their number, so this becomes the key that names each one and
          doubles as the way in. */}
      <div className="pb-6 pt-4">
        <p className="mx-auto hidden max-w-md text-center text-xs leading-relaxed text-muted sm:block">
          Each corner is a topic. The shape stretches toward the topics more
          people have spoken to. Tap a corner to open its tensions.
        </p>
        <ol className="mx-auto flex max-w-md flex-col gap-1 sm:hidden">
          {landscape.topics.map((topic, i) => (
            <li key={topic.id}>
              <Link
                href={`/landscape?topic=${i}`}
                className="flex items-baseline gap-2.5 rounded-md py-1 transition-colors active:bg-paper-2"
              >
                <span className="w-5 shrink-0 text-[10px] font-medium tracking-[0.12em] text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-sm leading-snug text-ink">
                  {topic.label}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/** Polygon radius as a percentage of the square chart box. */
const RADIUS = 30;
/** Rings drawn inside the polygon, as fractions of the radius. */
const RINGS = [0.34, 0.67];
/** How far the busiest topic's spike reaches, as a fraction of the radius. */
const PEAK = 0.95;

interface Corner {
  x: number;
  y: number;
  cos: number;
  sin: number;
}

function corners(count: number): Corner[] {
  return Array.from({ length: count }, (_, i) => {
    // Start at the top and run clockwise.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x: 50 + RADIUS * cos, y: 50 + RADIUS * sin, cos, sin };
  });
}

/**
 * Percentages destined for a style attribute. Browsers round the values they
 * parse, so a full-precision float would not match what the server sent and
 * hydration would report a mismatch.
 */
function pct(value: number): string {
  return `${value.toFixed(3)}%`;
}

/** A point some fraction of the way from the centre out to a corner. */
function toward(corner: Corner, fraction: number): { x: number; y: number } {
  return {
    x: 50 + (corner.x - 50) * fraction,
    y: 50 + (corner.y - 50) * fraction,
  };
}

/* ------------------------------------------------------------------ */
/* Chart                                                              */
/* ------------------------------------------------------------------ */

function Chart({ landscape }: { landscape: Landscape }) {
  const topics = landscape.topics;
  const cs = useMemo(() => corners(topics.length), [topics.length]);

  // How far each topic's spike reaches: its share of voices against the
  // busiest topic, so the fullest corner nearly touches its vertex and the
  // rest fall in proportion. This is the skew the shape is meant to show.
  const reach = useMemo(() => {
    const max = Math.max(1, ...topics.map((t) => t.voiceCount));
    return topics.map((t) => PEAK * (t.voiceCount / max));
  }, [topics]);

  const outline = cs.map((c) => `${c.x},${c.y}`).join(" ");
  const data = cs
    .map((c, i) => {
      const p = toward(c, reach[i]);
      return `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    })
    .join(" ");
  const line = "var(--color-line)";
  const hasShape = cs.length >= 3 && reach.some((r) => r > 0);

  return (
    <div className="relative aspect-square h-full max-h-full w-auto max-w-full">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {/* Spokes from the centre out to every topic */}
        {cs.map((c, i) => (
          <line
            key={`spoke-${i}`}
            x1="50"
            y1="50"
            x2={c.x}
            y2={c.y}
            stroke={line}
            strokeWidth="0.15"
          />
        ))}

        {/* Rings, then the frame: only meaningful from three corners up */}
        {cs.length >= 3 &&
          RINGS.map((r) => (
            <polygon
              key={`ring-${r}`}
              points={cs
                .map((c) => {
                  const p = toward(c, r);
                  return `${p.x},${p.y}`;
                })
                .join(" ")}
              fill="none"
              stroke={line}
              strokeWidth="0.15"
            />
          ))}
        {cs.length >= 3 ? (
          <polygon
            points={outline}
            fill="var(--color-paper-2)"
            fillOpacity="0.4"
            stroke={line}
            strokeWidth="0.22"
          />
        ) : (
          <polyline points={outline} fill="none" stroke={line} strokeWidth="0.22" />
        )}

        {/* The stats shape: how the crowd's attention leans across topics */}
        {hasShape && (
          <polygon
            points={data}
            fill="var(--color-ink)"
            fillOpacity="0.1"
            stroke="var(--color-ink)"
            strokeOpacity="0.55"
            strokeWidth="0.3"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {/* Topics: each corner is a clickable node plus its label */}
      {cs.map((corner, i) => {
        const topic = topics[i];
        const align =
          Math.abs(corner.cos) < 0.3
            ? "-translate-x-1/2"
            : corner.cos > 0
              ? "translate-x-0"
              : "-translate-x-full";
        const vertical =
          corner.sin < -0.3
            ? "-translate-y-full"
            : corner.sin > 0.3
              ? "translate-y-0"
              : "-translate-y-1/2";
        // On a phone every corner shows a centred number; from `sm` up the
        // label aligns outward from its corner. Full literals so Tailwind can
        // see (and generate) each responsive class.
        const smTextAlign =
          Math.abs(corner.cos) < 0.3
            ? "sm:text-center"
            : corner.cos > 0
              ? "sm:text-left"
              : "sm:text-right";
        const label = toward(corner, 1.16);
        return (
          <div key={topic.id}>
            {/* The node sitting on the vertex: a clear, tappable target */}
            <Link
              href={`/landscape?topic=${i}`}
              aria-label={`${topic.label}: open its tensions`}
              className="group absolute z-[6] -translate-x-1/2 -translate-y-1/2"
              style={{ left: pct(corner.x), top: pct(corner.y) }}
            >
              <span className="block h-3.5 w-3.5 rounded-full border-[1.5px] border-ink/60 bg-paper transition-all duration-150 group-hover:scale-125 group-hover:border-ink group-hover:bg-ink" />
            </Link>

            {/* The way in: on wider screens a numbered label with the topic's
                name; on a phone just the number, since the names live in the
                key below the chart where there is room for them. */}
            <Link
              href={`/landscape?topic=${i}`}
              aria-label={`${topic.label}: open its tensions`}
              className={`group absolute z-[6] block w-8 px-1 py-1 text-center sm:w-36 sm:px-1.5 ${align} ${vertical} ${smTextAlign}`}
              style={{ left: pct(label.x), top: pct(label.y) }}
            >
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-0.5 hidden font-display text-sm leading-snug text-ink sm:block sm:text-base">
                <span className="underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover:decoration-ink">
                  {topic.label}
                </span>
                <span
                  aria-hidden
                  className="ml-1 inline-block text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink"
                >
                  →
                </span>
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
