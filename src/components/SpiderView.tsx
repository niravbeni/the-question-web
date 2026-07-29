"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useMyPovIds } from "@/lib/mine";
import type { Landscape, SpiderPoint } from "@/lib/types";

/**
 * The whole landscape as one shape: a polygon whose corners are the topics
 * that emerged from the views. Every voice is a faint dot inside it, placed by
 * how strongly it pulls toward each topic; a soft marker shows where the crowd
 * as a whole leans, and one clear circle shows where you sit. Corners are the
 * way in: click one to read its tensions. Rendered as a slide of the landscape
 * carousel, so it carries no chrome of its own.
 */
export default function SpiderView({
  landscape,
  focusPovId,
}: {
  landscape: Landscape;
  focusPovId: string | null;
}) {
  const myIds = useMyPovIds();

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
        <Chart landscape={landscape} myIds={myIds} focusPovId={focusPovId} />
      </div>
      <div className="flex justify-center pb-1 pt-3">
        <Legend />
      </div>
    </div>
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

/** Mean of a set of points, or null when the set is empty. */
function meanPoint(
  points: Array<{ x: number; y: number }>,
): { x: number; y: number } | null {
  if (points.length === 0) return null;
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/* ------------------------------------------------------------------ */
/* Chart                                                              */
/* ------------------------------------------------------------------ */

function Chart({
  landscape,
  myIds,
  focusPovId,
}: {
  landscape: Landscape;
  myIds: string[];
  focusPovId: string | null;
}) {
  const topics = landscape.topics;
  const cs = useMemo(() => corners(topics.length), [topics.length]);

  const placed = useMemo(
    () =>
      landscape.spiderPoints.map((point) => ({ point, ...placePoint(point, cs) })),
    [landscape.spiderPoints, cs],
  );

  // Where the whole room leans: the centre of the cloud of voices. A rough
  // estimate, not a precise statistic, so it reads as a soft region.
  const crowd = useMemo(
    () => meanPoint(placed.map(({ x, y }) => ({ x, y }))),
    [placed],
  );

  // Where you sit: the average of the views published from this browser,
  // collapsed to a single marker so "you" is one clear point on the map.
  const you = useMemo(() => {
    const mine = placed.filter(
      ({ point }) =>
        point.povId === focusPovId || myIds.includes(point.povId),
    );
    return meanPoint(mine.map(({ x, y }) => ({ x, y })));
  }, [placed, myIds, focusPovId]);

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
          <polyline points={outline} fill="none" stroke={line} strokeWidth="0.4" />
        )}
      </svg>

      {/* Voices: faint texture showing the spread, not individually readable */}
      {placed.map(({ point, x, y }) => (
        <span
          key={point.povId}
          className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/15"
          style={{ left: pct(x), top: pct(y), zIndex: 2 }}
        />
      ))}

      {/* Where the crowd leans: a soft region behind the sharper markers */}
      {crowd && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: pct(crowd.x), top: pct(crowd.y), zIndex: 3 }}
        >
          <span className="block h-6 w-6 rounded-full bg-ink/10 ring-1 ring-ink/25" />
        </span>
      )}

      {/* Where you sit: one clear circle, the answer to "where am I?" */}
      {you && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: pct(you.x), top: pct(you.y), zIndex: 5 }}
        >
          <span className="block h-3.5 w-3.5 rounded-full bg-ink ring-4 ring-ink/15" />
          <span className="absolute left-1/2 top-full -translate-x-1/2 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
            you
          </span>
        </span>
      )}

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
              style={{ left: pct(corner.x), top: pct(corner.y), zIndex: 4 }}
            />
            <Link
              href={`/landscape?topic=${i}`}
              className={`group absolute z-[6] block max-w-[9.5rem] px-1.5 py-1 ${align} ${vertical} ${textAlign}`}
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
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
      <li className="flex items-center gap-2 text-xs text-muted">
        <span className="h-2 w-2 shrink-0 rounded-full bg-ink/15" />
        a voice
      </li>
      <li className="flex items-center gap-2 text-xs text-muted">
        <span className="h-4 w-4 shrink-0 rounded-full bg-ink/10 ring-1 ring-ink/25" />
        where most lean
      </li>
      <li className="flex items-center gap-2 text-xs text-muted">
        <span className="h-3 w-3 shrink-0 rounded-full bg-ink ring-2 ring-ink/15" />
        you
      </li>
      <li className="flex items-center gap-2 text-xs text-muted">
        <span className="h-2 w-2 shrink-0 rotate-45 border border-ink/50" />
        a topic
      </li>
    </ul>
  );
}
