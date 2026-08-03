"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Landscape } from "@/lib/types";

/**
 * The landscape as a 3D scatter plot: a light gridded cube where each theme is
 * a cluster, tension poles are dark diamonds at the ends of an axis through
 * that cluster, and the crowd on each axis is summarised by up to three lean
 * circles (toward one pole, torn in the middle, toward the other), sized by how
 * many voices sit there. The visitor's own published views float as small
 * pulsing "you" dots at the vector sum of their scores. Clicking a cluster's
 * heading opens that topic's tensions.
 */

/* ---------------- deterministic layout ---------------- */

const TOPIC_RADIUS = 13;
const AXIS_HALF = 4.4;
const SCORE_REACH = 3.4;
/** Radius shared by every voice dot, including the visitor's pulsing one. */
const DOT_RADIUS = 0.16;

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

/** One voice, placed at the vector sum of its tension scores. */
interface VoicePoint {
  povId: string;
  topicId: string;
  summary: string;
  color: string;
  pos: [number, number, number];
  /** True for the visitor's own published views: drawn as a pulsing dot. */
  isMine: boolean;
}

interface SpacePole {
  id: string;
  label: string;
  topicId: string;
  pos: [number, number, number];
}

interface SpaceTopic {
  id: string;
  index: number;
  label: string;
  color: string;
  center: [number, number, number];
}

interface SpaceLayout {
  topics: SpaceTopic[];
  poles: SpacePole[];
  points: VoicePoint[];
  /** Flat xyz pairs for the tension axis line segments. */
  axisSegments: Float32Array;
}

function buildLayout(landscape: Landscape, myIds: string[]): SpaceLayout {
  const mine = new Set(myIds);
  const topics: SpaceTopic[] = [];
  const poles: SpacePole[] = [];
  const points: VoicePoint[] = [];
  const axisSegs: number[] = [];

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
    topics.push({ id: topic.id, index: i, label: topic.label, color, center });

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
      poles.push(
        { id: `${tension.id}-a`, label: tension.poleA, topicId: topic.id, pos: a },
        { id: `${tension.id}-b`, label: tension.poleB, topicId: topic.id, pos: b },
      );
      axisSegs.push(...a, ...b);
    });

    // Every voice is its own dot at the vector sum of its scores across this
    // topic's tensions, so the crowd reads as exact positions between the
    // poles rather than a summarised blob.
    const scoresByPov = new Map<string, { summary: string; scores: number[] }>();
    topic.tensions.forEach((tension, j) => {
      for (const p of tension.points) {
        const entry =
          scoresByPov.get(p.povId) ?? { summary: p.summary, scores: [] as number[] };
        entry.scores[j] = p.score;
        scoresByPov.set(p.povId, entry);
      }
    });
    for (const [povId, entry] of scoresByPov) {
      const pos = new THREE.Vector3(...center);
      topic.tensions.forEach((_, j) => {
        const s = entry.scores[j];
        if (s === undefined) return;
        pos.addScaledVector(dirs[j], s * SCORE_REACH);
      });
      // Small deterministic jitter so identical scores never fully overlap.
      pos.x += (hash01(povId) - 0.5) * 0.9;
      pos.y += (hash01(povId + "y") - 0.5) * 0.9;
      pos.z += (hash01(povId + "z") - 0.5) * 0.9;
      points.push({
        povId,
        summary: entry.summary,
        topicId: topic.id,
        color,
        pos: [pos.x, pos.y, pos.z],
        isMine: mine.has(povId),
      });
    }
  });

  return {
    topics,
    poles,
    points,
    axisSegments: new Float32Array(axisSegs),
  };
}

/* ---------------- rendering helpers ---------------- */

/**
 * Keeps frames flowing even when the host throttles requestAnimationFrame
 * (embedded browsers): the lesson learned from the first 3D map.
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
 * Text as a 2D canvas texture on a sprite: avoids SDF-text WebGL issues.
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
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  text: string;
  position: [number, number, number];
  height?: number;
  color?: string;
  backing?: boolean;
  alwaysOnTop?: boolean;
  uppercase?: boolean;
  onClick?: (e: { stopPropagation: () => void }) => void;
  onPointerOver?: (e: { stopPropagation: () => void }) => void;
  onPointerOut?: () => void;
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
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
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

/**
 * The visitor's own dot: a solid core the same size as every other voice, with
 * a lighter halo that pulses outward on a loop so "you" is easy to find at a
 * glance even when it sits inside a cluster.
 */
function YouDot({
  position,
  color,
  dotRadius,
}: {
  position: [number, number, number];
  color: string;
  dotRadius: number;
}) {
  const halo = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    // Cap delta so watchdog-driven frames never jump the animation.
    t.current += Math.min(delta, 0.1);
    // A ping that grows from the core out to a wide, faint radius and repeats.
    const cycle = (t.current % 1.8) / 1.8;
    if (halo.current && haloMat.current) {
      halo.current.scale.setScalar(dotRadius * (1 + cycle * 6));
      haloMat.current.opacity = 0.4 * (1 - cycle);
    }
  });

  return (
    <group position={position}>
      {/* Expanding pulse halo: lighter and larger, draws the eye. */}
      <mesh ref={halo} raycast={() => null} renderOrder={11}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial
          ref={haloMat}
          color={color}
          transparent
          opacity={0.4}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* Solid core, same size as other voices, always on top. */}
      <mesh raycast={() => null} renderOrder={12}>
        <sphereGeometry args={[dotRadius, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={1} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Neon accent for the cluster-centre asterisk. */
const RETICLE_COLOR = "#d4f24a";

/**
 * Seven bar directions — three orthogonal axes plus the four cube diagonals —
 * so the centre reads as a 3D asterisk / starburst from any angle. Each
 * rotation turns a +x-aligned bar to point down its direction.
 */
const RETICLE_ROTATIONS: [number, number, number][] = (
  [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [-1, 1, 1],
  ] as const
).map((d) => {
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(d[0], d[1], d[2]).normalize(),
  );
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z] as [number, number, number];
});

/**
 * A cluster's centre: a small neon 3D asterisk. Reads as a structural
 * "centre here" marker from any angle, without being mistaken for one of the
 * coloured voice dots.
 */
function Reticle() {
  const len = 0.85;
  const thick = 0.07;
  // Outline via inverted hull: a slightly larger navy copy of each bar drawn
  // back-faced beneath the neon one reads as a thin outline from any angle.
  const outline = 0.06;
  return (
    <group>
      {RETICLE_ROTATIONS.map((rot, i) => (
        <group key={i} rotation={rot}>
          <mesh renderOrder={9}>
            <boxGeometry
              args={[len + outline, thick + outline, thick + outline]}
            />
            <meshBasicMaterial
              color="#232a3a"
              side={THREE.BackSide}
              transparent
              opacity={0.95}
              depthTest={false}
            />
          </mesh>
          <mesh renderOrder={10}>
            <boxGeometry args={[len, thick, thick]} />
            <meshBasicMaterial
              color={RETICLE_COLOR}
              transparent
              opacity={0.95}
              depthTest={false}
            />
          </mesh>
        </group>
      ))}
    </group>
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

/** Wall color: tinted enough that the white grid clearly reads. */
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
 * behind the data show and the walls between you and the data are culled: * the classic 3D scatter-plot cube. Numeric ticks run along the edges.
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
  fill = false,
}: {
  landscape: Landscape;
  myIds: string[];
  focusPovId: string | null;
  /** When true, fill the parent's height (for a carousel slide) instead of a
   *  fixed-height box, and float the reading text over the canvas. */
  fill?: boolean;
}) {
  const router = useRouter();
  const layout = useMemo(() => buildLayout(landscape, myIds), [landscape, myIds]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(focusPovId);
  // The plot drifts gently until the visitor takes the wheel.
  const [engaged, setEngaged] = useState(false);
  const shownId = hoveredId ?? pinnedId;

  // A hovered or pinned voice resolves to its summary and the topic it belongs
  // to (so that topic's pole labels appear).
  const detail = useMemo(() => {
    const m = new Map<string, { text: string; topicId: string }>();
    for (const p of layout.points) m.set(p.povId, { text: p.summary, topicId: p.topicId });
    return m;
  }, [layout]);
  const shown = shownId ? (detail.get(shownId) ?? null) : null;
  const activeTopicId = shown?.topicId ?? null;

  const setCursor = (value: "pointer" | "auto") => {
    document.body.style.cursor = value;
  };
  const openTopic = (index: number) => router.push(`/landscape?topic=${index}`);

  return (
    <div className={fill ? "flex h-full flex-col" : undefined}>
      <div
        className={
          "relative overflow-hidden rounded-[16px] border border-line bg-[#eef1f7] " +
          (fill ? "min-h-0 flex-1" : "h-[520px] sm:h-[560px]")
        }
      >
        <Canvas
          frameloop="never"
          dpr={[1, 2]}
          camera={{ position: [15, 10, 16], fov: 50 }}
          gl={{ antialias: true }}
          onPointerDown={() => setEngaged(true)}
          onPointerMissed={() => setPinnedId(null)}
        >
          <DriveFrames />
          <ambientLight intensity={1.1} />

          <PlotBox />

          {/* Tension axes through each cluster */}
          <SegmentLines segments={layout.axisSegments} color="#59627a" opacity={0.9} />

          {/* Theme clusters: the label and centre node both open the topic. */}
          {layout.topics.map((topic) => (
            <group key={topic.id}>
              <group position={topic.center}>
                {/* Invisible hit target keeps the centre clickable. */}
                <mesh
                  visible={false}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setCursor("pointer");
                  }}
                  onPointerOut={() => setCursor("auto")}
                  onClick={(e) => {
                    e.stopPropagation();
                    openTopic(topic.index);
                  }}
                >
                  <sphereGeometry args={[0.8, 12, 12]} />
                </mesh>
                <Reticle />
              </group>
              <LabelSprite
                text={topic.label}
                position={[topic.center[0], topic.center[1] + 2, topic.center[2]]}
                height={0.85}
                onClick={(e) => {
                  e.stopPropagation();
                  openTopic(topic.index);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setCursor("pointer");
                }}
                onPointerOut={() => setCursor("auto")}
              />
            </group>
          ))}

          {/* Tension pole markers: diamonds, so they never read as voices */}
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

          {/* Every voice as its own dot; the visitor's own views pulse and
              carry a "you" label on top. */}
          {layout.points.map((point) => {
            const isShown = shownId === point.povId;
            return (
              <group key={point.povId}>
                {/* Invisible, larger hit target for easy hovering. */}
                <mesh
                  position={point.pos}
                  visible={false}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setHoveredId(point.povId);
                    setCursor("pointer");
                  }}
                  onPointerOut={() => {
                    setHoveredId(null);
                    setCursor("auto");
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedId(pinnedId === point.povId ? null : point.povId);
                  }}
                >
                  <sphereGeometry args={[0.5, 8, 8]} />
                </mesh>

                {point.isMine ? (
                  <>
                    <YouDot position={point.pos} color={point.color} dotRadius={DOT_RADIUS} />
                    <LabelSprite
                      text="you"
                      position={[point.pos[0], point.pos[1] - 0.6, point.pos[2]]}
                      height={0.46}
                    />
                  </>
                ) : (
                  <mesh position={point.pos} scale={isShown ? 1.5 : 1}>
                    <sphereGeometry args={[DOT_RADIUS, 16, 16]} />
                    <meshBasicMaterial
                      color={point.color}
                      transparent
                      opacity={isShown ? 1 : 0.85}
                    />
                  </mesh>
                )}

                {/* A dark ring marks the hovered or pinned voice. */}
                {isShown && !point.isMine && (
                  <mesh position={point.pos}>
                    <sphereGeometry args={[DOT_RADIUS + 0.14, 16, 16]} />
                    <meshBasicMaterial color="#232a3a" transparent opacity={0.3} />
                  </mesh>
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
        <div className="pointer-events-none absolute left-3 top-3 max-w-56 space-y-1.5 rounded-[10px] border border-black/5 bg-white/80 px-3 py-2.5 backdrop-blur-sm sm:left-4 sm:top-4 sm:max-w-64 sm:px-3.5 sm:py-3">
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
                <span className="block h-2 w-2 rounded-full bg-[#3a4152]/70" />
              </span>
              <span className="text-[10px] leading-snug text-[#3a4152]">
                Other voices
              </span>
            </div>
            {layout.points.some((p) => p.isMine) && (
              <div className="flex items-center gap-2.5">
                <span className="relative flex w-4 shrink-0 items-center justify-center">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#3a4152]/50" />
                  <span className="relative block h-2 w-2 rounded-full bg-[#3a4152]/80" />
                </span>
                <span className="text-[10px] leading-snug text-[#3a4152]">
                  Your view
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Reading text floats at the top-right, opposite the key. */}
        {fill && shown && (
          <div className="pointer-events-none absolute right-3 top-3 flex max-w-56 justify-end sm:right-4 sm:top-4 sm:max-w-72">
            <p className="rounded-[10px] border border-black/5 bg-white/80 px-3 py-2.5 text-left text-xs leading-relaxed text-ink-soft backdrop-blur-sm sm:px-3.5 sm:py-3 sm:text-sm">
              {shown.text}
            </p>
          </div>
        )}
      </div>

      {/* On the standalone page the reading text sits below the canvas as plain
          text, no card. */}
      {!fill && (
        <div className="mx-auto mt-4 min-h-16 max-w-2xl px-2">
          {shown && (
            <p className="text-center text-sm leading-relaxed text-ink-soft">
              {shown.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
