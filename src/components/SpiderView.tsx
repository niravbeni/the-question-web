"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMyPovIds } from "@/lib/mine";
import type { Landscape, SpiderPoint } from "@/lib/types";

/**
 * The whole landscape as one shape: a polygon whose corners are the topics
 * that emerged from the views, with every voice placed inside according to how
 * strongly it pulls toward each topic. The polygon changes shape as topics
 * come and go. Corners are the way in: click one to read its tensions.
 */
export default function SpiderView({
  landscape,
  focusPovId,
}: {
  landscape: Landscape;
  focusPovId: string | null;
}) {
  const myIds = useMyPovIds();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(focusPovId);

  const topics = landscape.topics;
  const shownId = hoveredId ?? pinnedId;
  const shown = landscape.spiderPoints.find((p) => p.povId === shownId) ?? null;
  const shownTopicIndex = shown
    ? topics.findIndex((t) => t.id === shown.topicId)
    : -1;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-5">
        {/* Top bar: the way back, where you are, and the way in */}
        <div className="grid grid-cols-3 items-center border-b border-line py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 justify-self-start text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <Chevron />
            Back
          </Link>
          <Link
            href="/landscape?view=classic"
            className="justify-self-center text-xs font-medium uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
          >
            Classic view
          </Link>
          <Link
            href="/#starters"
            className="justify-self-end rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/85"
          >
            Add your view
          </Link>
        </div>

        {topics.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="max-w-sm text-center font-display text-xl leading-snug text-ink-soft">
              The landscape is still forming. Add the first views and topics will
              emerge.
            </p>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 items-center justify-center py-2">
              <Chart
                landscape={landscape}
                myIds={myIds}
                shownId={shownId}
                onHover={setHoveredId}
                onPick={(id) => setPinnedId((cur) => (cur === id ? null : id))}
              />
            </div>

            {/* Reading area: whichever voice is hovered or held */}
            <div className="flex items-start justify-between gap-6 border-t border-line py-4">
              <Legend />
              <div className="min-h-16 max-w-2xl flex-1">
                {shown ? (
                  <div className="rounded-[12px] border border-line bg-paper-2/50 px-5 py-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                        {myIds.includes(shown.povId) ? "Your view" : "One voice"}
                        {shownTopicIndex >= 0
                          ? ` · ${topics[shownTopicIndex].label}`
                          : ""}
                      </p>
                      {shownTopicIndex >= 0 && (
                        <Link
                          href={`/landscape?topic=${shownTopicIndex}`}
                          className="shrink-0 text-xs text-muted underline underline-offset-4 transition-colors hover:text-ink"
                        >
                          Open topic
                        </Link>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                      {shown.summary}
                    </p>
                  </div>
                ) : (
                  <p className="pt-1 text-sm text-muted">
                    Hover a dot to read a voice. Click a topic to open its tensions.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/** Polygon radius as a percentage of the square chart box. */
const RADIUS = 32;
/** Rings drawn inside the polygon, as fractions of the radius. */
const RINGS = [0.34, 0.67];
/**
 * How close to the polygon's edge a voice may sit, as a fraction of the
 * distance from the centre to the edge along its own direction. Kept under 1
 * so that a voice anchored almost entirely to one topic still reads as inside
 * the shape rather than sitting on the corner marker or its label.
 */
const MAX_FILL = 0.86;
/** Deterministic scatter, in polygon radii, so identical weights stay readable. */
const JITTER = 0.07;

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

/** Stable pseudo-random value in [-0.5, 0.5] from any string. */
function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

/**
 * Distance from the centre to the polygon's edge in one direction, in radii.
 * The edge is nearer than a corner everywhere between two corners, so a point
 * has to be measured against the edge it actually faces to stay inside.
 */
function edgeDistance(angle: number, count: number): number {
  const step = (2 * Math.PI) / count;
  // Angle to the nearest corner direction, which is where the edge is furthest.
  const offset = ((angle + Math.PI / 2) % step + step) % step - step / 2;
  return Math.cos(Math.PI / count) / Math.cos(offset);
}

/**
 * A voice sits at the weighted average of the corners it relates to, so voices
 * pulled by several topics land between them and single-minded ones land near
 * their own corner. The result is clamped to the polygon, which keeps every
 * voice inside the shape whether there are four topics or six.
 */
function placePoint(point: SpiderPoint, cs: Corner[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  cs.forEach((corner, i) => {
    const w = point.weights[i] ?? 0;
    x += w * corner.cos;
    y += w * corner.sin;
  });
  x += jitter(point.povId) * JITTER;
  y += jitter(`${point.povId}-y`) * JITTER;

  const radius = Math.hypot(x, y);
  if (radius > 0) {
    const limit = edgeDistance(Math.atan2(y, x), cs.length) * MAX_FILL;
    if (radius > limit) {
      x = (x / radius) * limit;
      y = (y / radius) * limit;
    }
  }
  return { x: 50 + x * RADIUS, y: 50 + y * RADIUS };
}

/* ------------------------------------------------------------------ */
/* Chart                                                              */
/* ------------------------------------------------------------------ */

function Chart({
  landscape,
  myIds,
  shownId,
  onHover,
  onPick,
}: {
  landscape: Landscape;
  myIds: string[];
  shownId: string | null;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  const topics = landscape.topics;
  const cs = useMemo(() => corners(topics.length), [topics.length]);
  const placed = useMemo(
    () =>
      landscape.spiderPoints.map((point) => ({ point, ...placePoint(point, cs) })),
    [landscape.spiderPoints, cs],
  );

  const outline = cs.map((c) => `${c.x},${c.y}`).join(" ");
  const line = "var(--color-line)";

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
            strokeWidth="0.25"
          />
        ))}

        {/* Rings, then the outline: only meaningful from three corners up */}
        {cs.length >= 3 &&
          RINGS.map((r) => (
            <polygon
              key={`ring-${r}`}
              points={cs
                .map((c) => `${50 + (c.x - 50) * r},${50 + (c.y - 50) * r}`)
                .join(" ")}
              fill="none"
              stroke={line}
              strokeWidth="0.2"
            />
          ))}
        {cs.length >= 3 ? (
          <polygon
            points={outline}
            fill="var(--color-paper-2)"
            fillOpacity="0.5"
            stroke={line}
            strokeWidth="0.4"
          />
        ) : (
          <polyline
            points={outline}
            fill="none"
            stroke={line}
            strokeWidth="0.4"
          />
        )}
      </svg>

      {/* Voices */}
      {placed.map(({ point, x, y }) => {
        const isMine = myIds.includes(point.povId);
        const isShown = shownId === point.povId;
        return (
          <button
            key={point.povId}
            onMouseEnter={() => onHover(point.povId)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onPick(point.povId)}
            aria-label="Read this point of view"
            className="absolute -translate-x-1/2 -translate-y-1/2 p-1.5"
            style={{
              left: pct(x),
              top: pct(y),
              zIndex: isMine || isShown ? 3 : 2,
            }}
          >
            <span
              className={
                isMine
                  ? "block h-3 w-3 rounded-full bg-ink ring-4 ring-ink/15 transition-transform duration-150" +
                    (isShown ? " scale-125" : "")
                  : isShown
                    ? "block h-2.5 w-2.5 scale-125 rounded-full bg-ink transition-transform duration-150"
                    : "block h-2.5 w-2.5 rounded-full bg-ink/25 transition-all duration-150 hover:bg-ink/60"
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

      {/* Topics: the corners, and the way into each one */}
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
        const textAlign =
          Math.abs(corner.cos) < 0.3
            ? "text-center"
            : corner.cos > 0
              ? "text-left"
              : "text-right";
        return (
          <div key={topic.id}>
            {/* Vertex marker */}
            <span
              className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-ink/50 bg-paper"
              style={{ left: pct(corner.x), top: pct(corner.y), zIndex: 1 }}
            />
            <Link
              href={`/landscape?topic=${i}`}
              className={`group absolute z-[4] block max-w-[9.5rem] px-1.5 py-1 ${align} ${vertical} ${textAlign}`}
              style={{
                left: pct(50 + (corner.x - 50) * 1.13),
                top: pct(50 + (corner.y - 50) * 1.13),
              }}
            >
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-0.5 block font-display text-sm leading-snug text-ink underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover:decoration-ink sm:text-base">
                {topic.label}
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <ul className="hidden shrink-0 space-y-1.5 pt-1 sm:block">
      <li className="flex items-center gap-2 text-xs text-muted">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink/25" />
        one voice
      </li>
      <li className="flex items-center gap-2 text-xs text-muted">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink ring-2 ring-ink/15" />
        your view
      </li>
      <li className="flex items-center gap-2 text-xs text-muted">
        <span className="h-2 w-2 shrink-0 rotate-45 border border-ink/50" />
        a topic
      </li>
    </ul>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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
