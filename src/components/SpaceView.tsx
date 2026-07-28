"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import type { Landscape } from "@/lib/types";

/**
 * The landscape as a 3D scatter plot: a light gridded cube where every voice
 * is a point colored by its theme, tension poles are dark diamonds, and each
 * voice floats at the vector sum of its tension scores. Faint spokes show how
 * each theme branches out to its voices; select a point and weighted lines
 * show how it sits between the poles.
 */

/* ---------------- deterministic layout ---------------- */

const TOPIC_RADIUS = 13;
const AXIS_HALF = 4.4;
const SCORE_REACH = 3.4;

/** One distinct hue per theme, scatter-plot style. */
const TOPIC_COLORS = [
  "#6f56c5", // purple
  "#3f6ad8", // blue
  "#0f9d8f", // teal
  "#e8823a", // orange
  "#d64545", // red
  "#4a9d4f", // green
];

/* Bounding box of the plot */
const BOX_W = 20; // x half-extent
const BOX_H = 12; // y half-extent
const BOX_D = 20; // z half-extent
const GRID_STEP = 5;

function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

interface PoleLink {
  pos: [number, number, number];
  label: string;
  /** 0..1 — how strongly this voice leans toward this pole. */
  weight: number;
}

interface SpacePoint {
  povId: string;
  summary: string;
  topicId: string;
  topicLabel: string;
  color: string;
  leans: string[];
  pos: [number, number, number];
  poleLinks: PoleLink[];
  isSeed: boolean;
}

interface SpacePole {
  id: string;
  label: string;
  topicId: string;
  pos: [number, number, number];
}

interface SpaceTopic {
  id: string;
  label: string;
  color: string;
  center: [number, number, number];
}

interface SpaceLayout {
  topics: SpaceTopic[];
  poles: SpacePole[];
  points: SpacePoint[];
  /** Flat xyz pairs for the tension axis line segments. */
  axisSegments: Float32Array;
  /** Flat xyz pairs for the faint theme-to-voice spokes. */
  spokeSegments: Float32Array;
}

function buildLayout(landscape: Landscape): SpaceLayout {
  const topics: SpaceTopic[] = [];
  const poles: SpacePole[] = [];
  const points: SpacePoint[] = [];
  const axisSegs: number[] = [];
  const spokeSegs: number[] = [];

  const K = landscape.topics.length;
  landscape.topics.forEach((topic, i) => {
    const color = TOPIC_COLORS[i % TOPIC_COLORS.length];
    // Golden-spiral distribution on a flattened sphere.
    const y = K > 1 ? 1 - (2 * (i + 0.5)) / K : 0;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399963;
    const center: [number, number, number] = [
      Math.cos(theta) * ring * TOPIC_RADIUS,
      y * TOPIC_RADIUS * 0.45,
      Math.sin(theta) * ring * TOPIC_RADIUS,
    ];
    topics.push({ id: topic.id, label: topic.label, color, center });

    // A topic-specific rotation so tension axes differ between clusters.
    const rot = new THREE.Euler(
      hash01(topic.id) * Math.PI,
      hash01(topic.id + "y") * Math.PI * 2,
      hash01(topic.id + "z") * Math.PI,
    );
    const base = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];
    const dirs = topic.tensions.map((_, j) =>
      base[j % 3].clone().applyEuler(rot).normalize(),
    );

    // Pole markers and the axis line through the cluster.
    const polePos: Array<{ a: [number, number, number]; b: [number, number, number] }> = [];
    topic.tensions.forEach((tension, j) => {
      const d = dirs[j];
      const a: [number, number, number] = [
        center[0] - d.x * AXIS_HALF,
        center[1] - d.y * AXIS_HALF,
        center[2] - d.z * AXIS_HALF,
      ];
      const b: [number, number, number] = [
        center[0] + d.x * AXIS_HALF,
        center[1] + d.y * AXIS_HALF,
        center[2] + d.z * AXIS_HALF,
      ];
      polePos.push({ a, b });
      poles.push(
        { id: `${tension.id}-a`, label: tension.poleA, topicId: topic.id, pos: a },
        { id: `${tension.id}-b`, label: tension.poleB, topicId: topic.id, pos: b },
      );
      axisSegs.push(...a, ...b);
    });

    // Each voice floats at the vector sum of its scores along the axes.
    const scoresByPov = new Map<string, { summary: string; isSeed: boolean; scores: number[] }>();
    topic.tensions.forEach((tension, j) => {
      for (const p of tension.points) {
        const entry =
          scoresByPov.get(p.povId) ??
          ({ summary: p.summary, isSeed: p.isSeed, scores: [] as number[] });
        entry.scores[j] = p.score;
        scoresByPov.set(p.povId, entry);
      }
    });
    for (const [povId, entry] of scoresByPov) {
      const pos = new THREE.Vector3(...center);
      const leans: string[] = [];
      const poleLinks: PoleLink[] = [];
      topic.tensions.forEach((tension, j) => {
        const s = entry.scores[j];
        if (s === undefined) return;
        pos.addScaledVector(dirs[j], s * SCORE_REACH);
        if (Math.abs(s) >= 0.2) {
          leans.push(s < 0 ? tension.poleA : tension.poleB);
        }
        // Links to both ends of this tension; the leaned-toward end is heavier.
        poleLinks.push(
          { pos: polePos[j].a, label: tension.poleA, weight: (1 - s) / 2 },
          { pos: polePos[j].b, label: tension.poleB, weight: (1 + s) / 2 },
        );
      });
      // Small deterministic jitter so identical scores do not overlap.
      pos.x += (hash01(povId) - 0.5) * 0.9;
      pos.y += (hash01(povId + "y") - 0.5) * 0.9;
      pos.z += (hash01(povId + "z") - 0.5) * 0.9;
      points.push({
        povId,
        summary: entry.summary,
        topicId: topic.id,
        topicLabel: topic.label,
        color,
        leans,
        pos: [pos.x, pos.y, pos.z],
        poleLinks,
        isSeed: entry.isSeed,
      });
      spokeSegs.push(...center, pos.x, pos.y, pos.z);
    }
  });

  return {
    topics,
    poles,
    points,
    axisSegments: new Float32Array(axisSegs),
    spokeSegments: new Float32Array(spokeSegs),
  };
}

/* ---------------- rendering helpers ---------------- */

/**
 * Keeps frames flowing even when the host throttles requestAnimationFrame
 * (embedded browsers) — the lesson learned from the first 3D map.
 */
function DriveFrames() {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      last = t;
      advance(t / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const watchdog = setInterval(() => {
      if (performance.now() - last > 200) advance(performance.now() / 1000);
    }, 100);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(watchdog);
    };
  }, [advance]);
  return null;
}

/**
 * Text as a 2D canvas texture on a sprite — avoids SDF-text WebGL issues.
 * Optionally drawn on a light backing plate; labels with `alwaysOnTop` skip
 * the depth test so they stay readable in front of geometry.
 */
function LabelSprite({
  text,
  position,
  height = 0.62,
  color = "#252b3b",
  backing = true,
  alwaysOnTop = true,
  uppercase = true,
}: {
  text: string;
  position: [number, number, number];
  height?: number;
  color?: string;
  backing?: boolean;
  alwaysOnTop?: boolean;
  uppercase?: boolean;
}) {
  const { texture, aspect } = useMemo(() => {
    const scale = 4;
    const canvas = document.createElement("canvas");
    const font = `600 ${11 * scale}px Inter, system-ui, sans-serif`;
    const measure = canvas.getContext("2d")!;
    measure.font = font;
    const label = uppercase ? text.toUpperCase() : text;
    const spacing = 1.2 * scale;
    const textWidth =
      measure.measureText(label).width + spacing * Math.max(0, label.length - 1);
    const padX = 10 * scale;
    canvas.width = Math.ceil(textWidth) + padX * 2;
    canvas.height = 20 * scale;

    const ctx = canvas.getContext("2d")!;
    if (backing) {
      const r = 9 * scale;
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.beginPath();
      ctx.roundRect(0, 0, canvas.width, canvas.height, r);
      ctx.fill();
    }
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    let x = padX;
    for (const ch of label) {
      ctx.fillText(ch, x, canvas.height / 2 + scale);
      x += ctx.measureText(ch).width + spacing;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { texture: tex, aspect: canvas.width / canvas.height };
  }, [text, color, backing, uppercase]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite
      position={position}
      scale={[height * aspect, height, 1]}
      renderOrder={alwaysOnTop ? 20 : 0}
    >
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        depthTest={!alwaysOnTop}
        toneMapped={false}
      />
    </sprite>
  );
}

function SegmentLines({
  segments,
  color,
  opacity,
}: {
  segments: Float32Array;
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(segments, 3));
    return g;
  }, [segments]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
}

/** Wall color — tinted enough that the white grid clearly reads. */
const WALL_COLOR = "#d5dbee";
const GRID_LINE = "rgba(255, 255, 255, 0.95)";

/**
 * A wall texture with the grid baked in, so grid and wall show and hide
 * together as the camera orbits.
 */
function makeWallTexture(wUnits: number, hUnits: number): THREE.CanvasTexture {
  const px = 24; // pixels per world unit
  const canvas = document.createElement("canvas");
  canvas.width = wUnits * px;
  canvas.height = hUnits * px;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = WALL_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 3;
  for (let x = 0; x <= wUnits; x += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(x * px, 0);
    ctx.lineTo(x * px, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= hUnits; y += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(0, y * px);
    ctx.lineTo(canvas.width, y * px);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * The plot cube: six gridded walls whose normals face inward, so the walls
 * behind the data show and the walls between you and the data are culled —
 * the classic 3D scatter-plot cube. Numeric ticks run along the edges.
 */
function PlotBox() {
  const textures = useMemo(
    () => ({
      floor: makeWallTexture(BOX_W * 2, BOX_D * 2),
      back: makeWallTexture(BOX_W * 2, BOX_H * 2),
      side: makeWallTexture(BOX_D * 2, BOX_H * 2),
    }),
    [],
  );
  useEffect(
    () => () => {
      textures.floor.dispose();
      textures.back.dispose();
      textures.side.dispose();
    },
    [textures],
  );

  const edgeSegments = useMemo(() => {
    const W = BOX_W;
    const H = BOX_H;
    const D = BOX_D;
    const corners: Array<[number, number, number]> = [
      [-W, -H, -D], [W, -H, -D], [W, -H, D], [-W, -H, D],
      [-W, H, -D], [W, H, -D], [W, H, D], [-W, H, D],
    ];
    const pairs = [
      [0, 1], [1, 2], [2, 3], [3, 0], // floor
      [4, 5], [5, 6], [6, 7], [7, 4], // ceiling
      [0, 4], [1, 5], [2, 6], [3, 7], // verticals
    ];
    const segs: number[] = [];
    for (const [a, b] of pairs) segs.push(...corners[a], ...corners[b]);
    return new Float32Array(segs);
  }, []);

  const ticks = useMemo(() => {
    const t: Array<{ value: number; pos: [number, number, number] }> = [];
    for (let x = -BOX_W; x <= BOX_W; x += GRID_STEP * 2) {
      t.push({ value: x, pos: [x, -BOX_H - 0.9, BOX_D + 0.9] });
    }
    for (let z = -BOX_D; z <= BOX_D; z += GRID_STEP * 2) {
      t.push({ value: z, pos: [BOX_W + 1.1, -BOX_H - 0.9, z] });
    }
    for (let y = -BOX_H + 2; y <= BOX_H; y += GRID_STEP) {
      t.push({ value: y, pos: [-BOX_W - 1.1, y, -BOX_D - 0.9] });
    }
    return t;
  }, []);

  const walls: Array<{
    tex: THREE.CanvasTexture;
    size: [number, number];
    pos: [number, number, number];
    rot: [number, number, number];
  }> = [
    { tex: textures.floor, size: [BOX_W * 2, BOX_D * 2], pos: [0, -BOX_H, 0], rot: [-Math.PI / 2, 0, 0] },
    { tex: textures.floor, size: [BOX_W * 2, BOX_D * 2], pos: [0, BOX_H, 0], rot: [Math.PI / 2, 0, 0] },
    { tex: textures.back, size: [BOX_W * 2, BOX_H * 2], pos: [0, 0, -BOX_D], rot: [0, 0, 0] },
    { tex: textures.back, size: [BOX_W * 2, BOX_H * 2], pos: [0, 0, BOX_D], rot: [0, Math.PI, 0] },
    { tex: textures.side, size: [BOX_D * 2, BOX_H * 2], pos: [-BOX_W, 0, 0], rot: [0, Math.PI / 2, 0] },
    { tex: textures.side, size: [BOX_D * 2, BOX_H * 2], pos: [BOX_W, 0, 0], rot: [0, -Math.PI / 2, 0] },
  ];

  return (
    <group>
      {/* Gridded walls, culled when they face away (i.e. when in front of the data) */}
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.pos} rotation={wall.rot}>
          <planeGeometry args={wall.size} />
          <meshBasicMaterial map={wall.tex} side={THREE.FrontSide} toneMapped={false} />
        </mesh>
      ))}

      {/* Cube edges, so the plot volume always reads */}
      <SegmentLines segments={edgeSegments} color="#a7aec4" opacity={0.9} />

      {/* Numeric ticks along the edges */}
      {ticks.map((tick, i) => (
        <LabelSprite
          key={i}
          text={String(tick.value)}
          position={tick.pos}
          height={0.6}
          color="#565e72"
          backing={false}
          alwaysOnTop={false}
        />
      ))}
    </group>
  );
}

/* ---------------- the view ---------------- */

export default function SpaceView({
  landscape,
  myIds,
  focusPovId,
}: {
  landscape: Landscape;
  myIds: string[];
  focusPovId: string | null;
}) {
  const layout = useMemo(() => buildLayout(landscape), [landscape]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(focusPovId);
  // The plot drifts gently until the visitor takes the wheel.
  const [engaged, setEngaged] = useState(false);
  const shownId = hoveredId ?? pinnedId;
  const shown = layout.points.find((p) => p.povId === shownId) ?? null;

  // Pole labels only for the active cluster, so the plot stays legible.
  const activeTopicId = shown?.topicId ?? null;

  return (
    <div>
      <div className="relative h-[520px] overflow-hidden rounded-[16px] border border-line bg-[#eef1f7] sm:h-[560px]">
        <Canvas
          frameloop="never"
          dpr={[1, 2]}
          camera={{ position: [26, 19, 42], fov: 50 }}
          gl={{ antialias: true }}
          onPointerDown={() => setEngaged(true)}
          onPointerMissed={() => setPinnedId(null)}
        >
          <DriveFrames />
          <ambientLight intensity={1.1} />

          <PlotBox />

          {/* Tension axes and the faint branches from theme to voices */}
          <SegmentLines segments={layout.axisSegments} color="#59627a" opacity={0.9} />
          <SegmentLines segments={layout.spokeSegments} color="#6e7791" opacity={0.5} />

          {/* When a voice is shown: dark lines to both ends of its tensions,
              heavier toward the pole it leans to. */}
          {shown &&
            shown.poleLinks.map((link, i) => (
              <Line
                key={i}
                points={[shown.pos, link.pos]}
                color="#232a3a"
                transparent
                opacity={0.15 + 0.6 * link.weight}
                lineWidth={0.6 + 1.8 * link.weight}
              />
            ))}

          {/* Theme clusters */}
          {layout.topics.map((topic) => (
            <group key={topic.id}>
              <mesh position={topic.center}>
                <sphereGeometry args={[1.05, 24, 24]} />
                <meshBasicMaterial color={topic.color} transparent opacity={0.14} />
              </mesh>
              <mesh position={topic.center}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshBasicMaterial color={topic.color} transparent opacity={0.9} />
              </mesh>
              <LabelSprite
                text={topic.label}
                position={[topic.center[0], topic.center[1] + 2, topic.center[2]]}
                height={0.85}
              />
            </group>
          ))}

          {/* Tension pole markers — diamonds, so they never read as voices */}
          {layout.poles.map((pole) => (
            <group key={pole.id}>
              <mesh position={pole.pos}>
                <octahedronGeometry args={[0.32, 0]} />
                <meshBasicMaterial color="#39415a" transparent opacity={0.95} />
              </mesh>
              {pole.topicId === activeTopicId && (
                <LabelSprite
                  text={pole.label}
                  position={[pole.pos[0], pole.pos[1] - 0.85, pole.pos[2]]}
                  height={0.52}
                  color="#3a4152"
                />
              )}
            </group>
          ))}

          {/* Voices */}
          {layout.points.map((point) => {
            const isMine = myIds.includes(point.povId);
            const isShown = shownId === point.povId;
            return (
              <group key={point.povId}>
                <mesh
                  position={point.pos}
                  scale={isShown ? 1.4 : 1}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setHoveredId(point.povId);
                    document.body.style.cursor = "pointer";
                  }}
                  onPointerOut={() => {
                    setHoveredId(null);
                    document.body.style.cursor = "auto";
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedId(pinnedId === point.povId ? null : point.povId);
                  }}
                >
                  <sphereGeometry args={[isMine ? 0.34 : 0.24, 16, 16]} />
                  <meshBasicMaterial color={point.color} transparent opacity={isShown || isMine ? 1 : 0.85} />
                </mesh>
                {/* Selected point gets a dark outline ring for emphasis */}
                {isShown && (
                  <mesh position={point.pos}>
                    <sphereGeometry args={[isMine ? 0.44 : 0.34, 16, 16]} />
                    <meshBasicMaterial color="#232a3a" transparent opacity={0.35} />
                  </mesh>
                )}
                {/* Invisible, larger hit target for easier hovering */}
                <mesh
                  position={point.pos}
                  visible={false}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setHoveredId(point.povId);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedId(pinnedId === point.povId ? null : point.povId);
                  }}
                >
                  <sphereGeometry args={[0.9, 8, 8]} />
                </mesh>
                {isMine && (
                  <LabelSprite
                    text="you"
                    position={[point.pos[0], point.pos[1] - 0.7, point.pos[2]]}
                    height={0.46}
                  />
                )}
              </group>
            );
          })}

          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            autoRotate={!engaged && shownId === null}
            autoRotateSpeed={0.3}
            minDistance={8}
            maxDistance={70}
            enablePan={false}
          />
        </Canvas>

        {/* Key */}
        <div className="pointer-events-none absolute left-3 top-3 max-w-64 space-y-1.5 rounded-[10px] border border-black/5 bg-white/80 px-3.5 py-3 backdrop-blur-sm sm:left-4 sm:top-4">
          {layout.topics.map((topic) => (
            <div key={topic.id} className="flex items-center gap-2.5">
              <span className="flex w-4 shrink-0 justify-center">
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ backgroundColor: topic.color }}
                />
              </span>
              <span className="text-[10px] leading-snug text-[#3a4152]">
                {topic.label}
              </span>
            </div>
          ))}
          <div className="!mt-2.5 space-y-1.5 border-t border-black/10 pt-2">
            <div className="flex items-center gap-2.5">
              <span className="flex w-4 shrink-0 justify-center">
                <span className="block h-2 w-2 rotate-45 bg-[#4b5468]" />
              </span>
              <span className="text-[10px] leading-snug text-[#3a4152]">
                One end of a tension
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex w-4 shrink-0 justify-center">
                <span className="block h-2 w-2 rounded-full bg-[#3a4152]/60" />
              </span>
              <span className="text-[10px] leading-snug text-[#3a4152]">
                One voice — closer to the end it leans toward
              </span>
            </div>
          </div>
        </div>

        <p className="pointer-events-none absolute bottom-3 left-4 right-4 text-[10px] uppercase tracking-wider text-[#5a6275]/70">
          drag to orbit · scroll to zoom · tap a voice to see how it sits between the poles
        </p>
      </div>

      {/* Reading panel, same pattern as the axes view */}
      <div className="mx-auto mt-4 min-h-28 max-w-2xl">
        {shown ? (
          <div className="rounded-[12px] border border-line bg-paper-2/50 px-5 py-4 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
              {myIds.includes(shown.povId) ? "Your view" : "One voice"} ·{" "}
              {shown.topicLabel}
              {shown.leans.length > 0 && ` · leans ${shown.leans.join(" + ")}`}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{shown.summary}</p>
          </div>
        ) : (
          <p className="pt-4 text-center text-xs text-muted/60">
            Hover or tap a dot to read a view. Each voice floats between the poles it
            leans toward.
          </p>
        )}
      </div>
    </div>
  );
}
