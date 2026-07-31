import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { ANALYSIS_MODEL, getOpenAI } from "@/lib/openai";
import { embedText } from "@/lib/embeddings";
import {
  commitCalibration,
  countPoorFitsSinceLastCalibration,
  countPovsSinceLastCalibration,
  getPovsWithEmbeddings,
  getTensionsByTopic,
  getTopics,
  setPovEmbedding,
  setPovFit,
  setPovTopic,
  upsertPosition,
  type CalibrationResult,
} from "@/lib/db";
import type {
  Pov,
  PovPosition,
  Tension,
  TensionSections,
  Topic,
} from "@/lib/types";

/** Minimum published views before a full recalibration makes sense. */
const MIN_POVS_FOR_CALIBRATION = 8;
/** New views that accumulate before a recalibration fires automatically. */
export const RECALIBRATION_THRESHOLD = 8;
/** Below this placement fit, a view counts as poorly covered by current topics. */
const POOR_FIT = 0.55;
/** Below this fit, a new view is left unplaced rather than forced into a topic. */
const NO_FIT = 0.3;
/** Poorly-fitting new voices that trigger an early recalibration. */
const DRIFT_TRIGGER = 3;

/** Shared framing so every analysis call works from the same ground rules. */
const ANALYST_ROLE = `You are the analysis engine for "Women's Health × AI", a public IDEO project mapping where people genuinely stand. You work only from what people actually said. You never invent positions, never sand disagreements down into consensus, and never force views into categories they do not fit. Never use em dashes or en dashes in any labels, summaries, questions, or poles you write; use commas, periods, colons, or hyphens instead.`;

/* ------------------------------------------------------------------ */
/* Immediate placement: slot one new pov into the existing landscape.  */
/* ------------------------------------------------------------------ */

export interface PlacementResult {
  topicId: string | null;
  positions: PovPosition[];
}

/**
 * When someone publishes, place their view into the current landscape right
 * away: the analysis model picks the best-fitting existing topic and scores
 * the view on that topic's tensions. A later recalibration may move it.
 */
export async function placeNewPov(pov: Pov): Promise<PlacementResult> {
  const openai = getOpenAI();
  const topics = await getTopics();
  if (!openai || topics.length === 0) {
    return { topicId: null, positions: [] };
  }

  const topicsWithTensions = await Promise.all(
    topics.map(async (t) => ({
      topic: t,
      tensions: await getTensionsByTopic(t.id),
    })),
  );

  const topicBlock = topicsWithTensions
    .map(({ topic, tensions }, i) => {
      const tensionLines = tensions
        .map(
          (tn, j) =>
            `    tension ${j}: "${tn.poleA}" (score -1) <-> "${tn.poleB}" (score 1). At stake: ${tn.question}`,
        )
        .join("\n");
      return `topic ${i}: ${topic.label}: ${topic.summary}\n${tensionLines}`;
    })
    .join("\n");

  const prompt = `${ANALYST_ROLE}

Place one new point of view into the existing landscape.

TOPICS AND THEIR CREATIVE TENSIONS
${topicBlock}

NEW POINT OF VIEW
Summary: ${pov.summary}
Original words: ${pov.rawInput}

Steps:
1. Choose the single topic whose SUBJECT this view is about. Match on subject and the decision at stake, not on tone.
2. Rate "fit" from 0 to 1: 1 means the topic clearly covers this view; below 0.3 means no listed topic covers it. Do not force a bad match: if nothing fits, say so with topic_index -1 and the view will wait for the next recalibration.
3. Score the view on EACH of the chosen topic's tensions, based only on what it says:
   - -1.0 to -0.7 / 0.7 to 1.0: clearly committed to that pole.
   - -0.6 to -0.3 / 0.3 to 0.6: leans that way with reservations.
   - -0.2 to 0.2: explicitly torn, weighs both sides, or the tension does not apply.
   If the view takes any side at all, score it off-center.

Respond with JSON only: {"topic_index": <int, or -1 if none fit>, "fit": <0..1>, "scores": [<one float per tension of the chosen topic, in order>]}`;

  const parsed = await jsonCall<{
    topic_index: number;
    fit: number;
    scores: number[];
  }>(openai, prompt);
  if (!parsed) return { topicId: null, positions: [] };

  const fit =
    typeof parsed.fit === "number" ? Math.max(0, Math.min(1, parsed.fit)) : null;
  await setPovFit(pov.id, fit);

  const chosen = topicsWithTensions[parsed.topic_index];
  if (!chosen || (fit !== null && fit < NO_FIT)) {
    // Deliberately unplaced: the current landscape does not cover this view.
    return { topicId: null, positions: [] };
  }

  const positions: PovPosition[] = chosen.tensions.map((tn, j) => ({
    povId: pov.id,
    tensionId: tn.id,
    score: typeof parsed.scores?.[j] === "number" ? parsed.scores[j] : 0,
  }));

  await setPovTopic(pov.id, chosen.topic.id);
  for (const p of positions) await upsertPosition(p);
  return { topicId: chosen.topic.id, positions };
}

/* ------------------------------------------------------------------ */
/* Full recalibration: cluster all povs, re-derive topics & tensions.  */
/* ------------------------------------------------------------------ */

export interface RecalibrationSummary {
  ok: boolean;
  reason?: string;
  topicCount?: number;
  povCount?: number;
}

let recalibrating = false;

export function isRecalibrating(): boolean {
  return recalibrating;
}

/**
 * The full pipeline:
 * 1. Embed any povs that lack embeddings.
 * 2. Cluster all povs with k-means over embeddings.
 * 3. Per cluster, the analysis model derives a label, a summary, and 2-3
 *    creative tensions from the member views.
 * 4. Per cluster, the analysis model scores every member view on every tension.
 * 5. Commit the new landscape atomically.
 */
export async function recalibrate(): Promise<RecalibrationSummary> {
  const openai = getOpenAI();
  if (!openai) return { ok: false, reason: "OPENAI_API_KEY is not configured." };
  if (recalibrating) return { ok: false, reason: "A recalibration is already running." };

  recalibrating = true;
  try {
    const povs = await getPovsWithEmbeddings();
    if (povs.length < MIN_POVS_FOR_CALIBRATION) {
      return {
        ok: false,
        reason: `Need at least ${MIN_POVS_FOR_CALIBRATION} published views (have ${povs.length}).`,
      };
    }

    // 1. Fill in missing embeddings.
    for (const pov of povs) {
      if (!pov.embedding) {
        const emb = await embedText(`${pov.summary}\n\n${pov.rawInput}`);
        if (emb) {
          pov.embedding = emb;
          await setPovEmbedding(pov.id, emb);
        }
      }
    }
    const embedded = povs.filter(
      (p): p is (typeof povs)[number] & { embedding: number[] } => p.embedding !== null,
    );
    if (embedded.length < MIN_POVS_FOR_CALIBRATION) {
      return { ok: false, reason: "Could not embed enough views to cluster." };
    }

    // 2. Cluster. The analysis model groups by meaning, which separates views
    // far better than embedding distance in a single-domain corpus. k-means
    // over embeddings is the fallback for very large counts or model failure.
    const vectors = embedded.map((p) => p.embedding);
    let clusters: number[][] | null = null;
    if (embedded.length <= 120) {
      clusters = await llmCluster(openai, embedded);
    }
    if (!clusters) {
      const k = Math.max(2, Math.min(6, Math.round(Math.sqrt(embedded.length))));
      clusters = mergeSmallClusters(vectors, kMeans(vectors, k), 3);
    }

    // 3 + 4. Derive topics/tensions and score members. Each cluster costs
    // several model calls and knows nothing of the others, so they are worked
    // through together: a full recalibration has to finish inside the time
    // limit of the route that triggered it.
    const runId = randomUUID();
    const built = await Promise.all(
      clusters.map(async (cluster, c) => {
        const members = cluster.map((idx) => embedded[idx]);
        if (members.length === 0) return null;

        const derived = await deriveTopic(openai, members);
        if (!derived) return null;

        const topicId = `topic-${runId.slice(0, 8)}-${c}`;
        const topic: Topic = {
          id: topicId,
          label: derived.label,
          summary: derived.summary,
          sortOrder: c + 1,
        };
        const tensions: Tension[] = derived.tensions.map((t, j) => ({
          id: `${topicId}-tn${j}`,
          topicId,
          poleA: t.pole_a,
          poleB: t.pole_b,
          question: t.question,
          sortOrder: j + 1,
          sections: { left: null, center: null, right: null },
        }));

        const positions = await scoreMembers(openai, members, tensions);
        // Now that everyone is scored, describe what each third of every axis
        // holds in common, so the tension view can be read without hovering.
        const sections = await Promise.all(
          tensions.map((tension) =>
            summarizeSections(openai, members, tension, positions),
          ),
        );
        tensions.forEach((tension, i) => {
          tension.sections = sections[i];
        });

        return {
          topic,
          centroid: meanVector(members.map((m) => m.embedding)),
          tensions,
          memberPovIds: members.map((m) => m.id),
          positions,
        };
      }),
    );
    // Promise.all keeps cluster order, so topics stay in their sorted order.
    const resultTopics: CalibrationResult["topics"] = built.filter(
      (t): t is NonNullable<typeof t> => t !== null,
    );

    if (resultTopics.length === 0) {
      return { ok: false, reason: "The analysis model returned no usable topics." };
    }

    // 5. Commit atomically.
    await commitCalibration({ runId, topics: resultTopics });
    return {
      ok: true,
      topicCount: resultTopics.length,
      povCount: embedded.length,
    };
  } finally {
    recalibrating = false;
  }
}

/**
 * Fire-and-forget recalibration on two signals:
 * 1. Volume: enough new voices have accumulated since the last run.
 * 2. Drift: several new voices fit the current topics poorly (or not at all),
 *    meaning the conversation is leaning somewhere the landscape doesn't cover.
 */
export async function maybeAutoRecalibrate(): Promise<void> {
  if (recalibrating) return;
  const newVoices = await countPovsSinceLastCalibration();
  const poorFits = await countPoorFitsSinceLastCalibration(POOR_FIT);
  const volume = newVoices >= RECALIBRATION_THRESHOLD;
  const drift = poorFits >= DRIFT_TRIGGER;
  if (!volume && !drift) return;
  console.log(
    `auto recalibration: ${newVoices} new voices, ${poorFits} poor fits (${volume ? "volume" : "drift"})`,
  );
  await recalibrate().catch((err) => console.error("auto recalibration failed", err));
}

/* ---------- LLM steps ---------- */

/**
 * Ask the analysis model to partition all views into coherent topics.
 * Returns clusters of indexes into `povs`, or null if the response is
 * unusable. Indexes the model drops are folded into the largest cluster.
 */
async function llmCluster(openai: OpenAI, povs: Pov[]): Promise<number[][] | null> {
  const list = povs.map((p, i) => `${i}. ${p.summary}`).join("\n");
  const target = Math.max(3, Math.min(6, Math.round(Math.sqrt(povs.length))));
  const prompt = `${ANALYST_ROLE}

Group these anonymous points of view into topics.

${list}

Rules:
- Group by SUBJECT: what the view is about and the decision at stake: not by tone, strength of feeling, or whether it is optimistic about AI.
- Let the groups emerge from these views as they are today. Do not reach for standard categories; if several views converge on a subject that was not prominent before, that is a real group and deserves to be one. The whole point of regrouping is to notice when the conversation has moved.
- Each group must share a genuinely common subject (e.g. who controls body data, whose symptoms models learn, what stays human in care): never a catch-all like "AI in health".
- Form ${Math.max(3, target - 1)} to ${Math.min(6, target + 1)} groups. Prefer groups of at least 3 views. Only leave a view alone if it truly fits nowhere.
- Every index from 0 to ${povs.length - 1} must appear in exactly one group.

Respond with JSON only: {"clusters": [[<indexes>], [<indexes>], ...]}`;

  const parsed = await jsonCall<{ clusters: number[][] }>(openai, prompt);
  if (!parsed || !Array.isArray(parsed.clusters)) return null;

  const seen = new Set<number>();
  const clusters: number[][] = [];
  for (const group of parsed.clusters) {
    if (!Array.isArray(group)) continue;
    const clean = group.filter(
      (i) => Number.isInteger(i) && i >= 0 && i < povs.length && !seen.has(i),
    );
    for (const i of clean) seen.add(i);
    if (clean.length > 0) clusters.push(clean);
  }
  if (clusters.length < 2) return null;

  // Fold any dropped indexes into the largest cluster.
  const largest = clusters.reduce((a, b) => (b.length > a.length ? b : a));
  for (let i = 0; i < povs.length; i++) {
    if (!seen.has(i)) largest.push(i);
  }
  return clusters;
}

interface DerivedTopic {
  label: string;
  summary: string;
  tensions: Array<{ pole_a: string; pole_b: string; question: string }>;
}

async function deriveTopic(
  openai: OpenAI,
  members: Pov[],
): Promise<DerivedTopic | null> {
  const list = members.map((m, i) => `${i}. ${m.summary}`).join("\n");
  const prompt = `${ANALYST_ROLE}

These points of view were grouped together because they share a subject:

${list}

Derive from them:

1. "label": a topic name of at most 5 words. Plain language, concrete, specific to this cluster: never generic ("AI in healthcare") and never alarmist.

2. "summary": one sentence naming the shared subject AND the live disagreement inside it.

3. "tensions": exactly 2 creative tensions: the axes these views ACTUALLY divide along. For each:
   - "pole_a" and "pole_b": short phrases (max 6 words), each a position that at least one of these views genuinely holds or clearly leans toward. Both poles must have real merit: never a reasonable position versus a strawman, and never generic axes like optimism vs pessimism or pro-AI vs anti-AI. Find the specific trade-off: what would one group protect that the other would spend?
   - "question": a short, direct question of at most 12 words naming what is at stake between the poles. No preamble, no stacked clauses; cut every word that does not earn its place. Prefer "Guard privacy or pool data for research?" over a long either/or sentence.
   A reader should be able to point at specific views above that sit near each pole. If you cannot, the tension is invented: replace it with a sharper one.

Return exactly two tensions. Even if these views mostly agree, surface the two most meaningful fault lines rather than manufacturing hostility.

Respond with JSON only:
{"label": "...", "summary": "...", "tensions": [{"pole_a": "...", "pole_b": "...", "question": "..."}, {"pole_a": "...", "pole_b": "...", "question": "..."}]}`;

  const parsed = await jsonCall<DerivedTopic>(openai, prompt);
  if (!parsed || !parsed.label || !Array.isArray(parsed.tensions)) return null;
  // Ask for two; keep at most two, and accept fewer if that is all it found.
  parsed.tensions = parsed.tensions.slice(0, 2);
  return parsed;
}

async function scoreMembers(
  openai: OpenAI,
  members: Pov[],
  tensions: Tension[],
): Promise<PovPosition[]> {
  if (tensions.length === 0) return [];
  const tensionLines = tensions
    .map(
      (t, j) =>
        `tension ${j}: "${t.poleA}" (score -1) <-> "${t.poleB}" (score 1). At stake: ${t.question}`,
    )
    .join("\n");
  const list = members.map((m, i) => `${i}. ${m.summary}`).join("\n");

  const prompt = `${ANALYST_ROLE}

Score each point of view on each creative tension.

TENSIONS
${tensionLines}

POINTS OF VIEW
${list}

Scoring rubric: base every score only on what the view itself says, never on what similar views usually think:
- -1.0 to -0.7 / 0.7 to 1.0: clearly committed to that pole.
- -0.6 to -0.3 / 0.3 to 0.6: leans that way with reservations or conditions.
- -0.2 to 0.2: explicitly torn, argues both sides, or the tension does not apply to this view.
If a view takes any side at all, score it off-center. Differentiate the views: a flat row of zeros means you have not read them.

Respond with JSON only: {"positions": [{"index": <view index>, "scores": [<one float per tension, in order>]}]} covering every view exactly once.`;

  const parsed = await jsonCall<{
    positions: Array<{ index: number; scores: number[] }>;
  }>(openai, prompt);
  if (!parsed || !Array.isArray(parsed.positions)) return [];

  const out: PovPosition[] = [];
  for (const row of parsed.positions) {
    const pov = members[row.index];
    if (!pov || !Array.isArray(row.scores)) continue;
    tensions.forEach((t, j) => {
      const s = row.scores[j];
      out.push({
        povId: pov.id,
        tensionId: t.id,
        score: typeof s === "number" ? s : 0,
      });
    });
  }
  return out;
}

/** Score below which a view counts as sitting on the left third of an axis. */
const SECTION_EDGE = 1 / 3;

/**
 * Describe what the voices on the left, in the middle, and on the right of one
 * tension hold in common. Empty thirds come back null so the view can show
 * that nobody stands there yet.
 */
async function summarizeSections(
  openai: OpenAI,
  members: Pov[],
  tension: Tension,
  positions: PovPosition[],
): Promise<TensionSections> {
  const empty: TensionSections = { left: null, center: null, right: null };
  const scoreByPov = new Map(
    positions
      .filter((p) => p.tensionId === tension.id)
      .map((p) => [p.povId, p.score]),
  );

  const buckets: Record<keyof TensionSections, string[]> = {
    left: [],
    center: [],
    right: [],
  };
  for (const m of members) {
    const score = scoreByPov.get(m.id);
    if (score === undefined) continue;
    const key =
      score < -SECTION_EDGE ? "left" : score > SECTION_EDGE ? "right" : "center";
    buckets[key].push(m.summary);
  }
  if (buckets.left.length + buckets.center.length + buckets.right.length === 0) {
    return empty;
  }

  const block = (label: string, list: string[]) =>
    list.length === 0
      ? `${label}: (nobody stands here)`
      : `${label}:\n${list.map((s) => `- ${s}`).join("\n")}`;

  const prompt = `${ANALYST_ROLE}

Summarize each side of one creative tension.

THE TENSION
"${tension.poleA}" (left) <-> "${tension.poleB}" (right). At stake: ${tension.question}

${block("LEFT: views committed to " + tension.poleA, buckets.left)}

${block("MIDDLE: views that weigh both sides or are torn", buckets.center)}

${block("RIGHT: views committed to " + tension.poleB, buckets.right)}

For each group that has views, write one sentence of at most 18 words saying what those people actually hold in common, in their spirit, without naming numbers or using the words "left", "middle", or "right". Write it as a claim someone there would recognize, not a description of a category. Use null for any group where nobody stands.

Respond with JSON only: {"left": "..." | null, "center": "..." | null, "right": "..." | null}`;

  const parsed = await jsonCall<Record<string, unknown>>(openai, prompt);
  if (!parsed) return empty;

  const clean = (value: unknown, hasViews: boolean): string | null =>
    hasViews && typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;

  return {
    left: clean(parsed.left, buckets.left.length > 0),
    center: clean(parsed.center, buckets.center.length > 0),
    right: clean(parsed.right, buckets.right.length > 0),
  };
}

/** Component-wise mean of the vectors that exist, or null if none do. */
function meanVector(vectors: Array<number[] | null>): number[] | null {
  const present = vectors.filter((v): v is number[] => Array.isArray(v) && v.length > 0);
  if (present.length === 0) return null;
  const dim = present[0].length;
  const mean = new Array<number>(dim).fill(0);
  for (const v of present) {
    for (let d = 0; d < dim; d++) mean[d] += v[d] ?? 0;
  }
  return mean.map((x) => x / present.length);
}

/** One JSON-mode call to the analysis model, parsed defensively. */
async function jsonCall<T>(openai: OpenAI, prompt: string): Promise<T | null> {
  try {
    const res = await openai.chat.completions.create({
      model: ANALYSIS_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch (err) {
    console.error("analysis model call failed", err);
    return null;
  }
}

/* ---------- k-means ---------- */

/**
 * Plain k-means with deterministic farthest-point initialization. Returns an
 * array of clusters, each an array of indexes into `vectors`. Empty clusters
 * are dropped.
 */
function kMeans(vectors: number[][], k: number, iterations = 40): number[][] {
  const n = vectors.length;
  if (n === 0) return [];
  if (k >= n) return vectors.map((_, i) => [i]);

  // Deterministic init: first centroid is vector 0; each next centroid is the
  // point farthest from all chosen so far.
  const centroidIdx: number[] = [0];
  while (centroidIdx.length < k) {
    let best = -1;
    let bestDist = -Infinity;
    for (let i = 0; i < n; i++) {
      if (centroidIdx.includes(i)) continue;
      const d = Math.min(...centroidIdx.map((c) => sqDist(vectors[i], vectors[c])));
      if (d > bestDist) {
        bestDist = d;
        best = i;
      }
    }
    centroidIdx.push(best);
  }
  let centroids = centroidIdx.map((i) => [...vectors[i]]);

  let assignment = new Array<number>(n).fill(0);
  for (let iter = 0; iter < iterations; iter++) {
    const next = vectors.map((v) => {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = sqDist(v, centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return best;
    });
    const changed = next.some((c, i) => c !== assignment[i]);
    assignment = next;

    centroids = centroids.map((old, c) => {
      const members = vectors.filter((_, i) => assignment[i] === c);
      if (members.length === 0) return old;
      const dim = members[0].length;
      const mean = new Array<number>(dim).fill(0);
      for (const m of members) for (let d = 0; d < dim; d++) mean[d] += m[d];
      return mean.map((x) => x / members.length);
    });

    if (!changed) break;
  }

  const clusters: number[][] = Array.from({ length: k }, () => []);
  assignment.forEach((c, i) => clusters[c].push(i));
  return clusters.filter((c) => c.length > 0);
}

/**
 * Reassign members of clusters smaller than `minSize` to the nearest
 * sufficiently-large cluster (by centroid distance). If every cluster is
 * small, the original clustering is returned unchanged.
 */
function mergeSmallClusters(
  vectors: number[][],
  clusters: number[][],
  minSize: number,
): number[][] {
  const large = clusters.filter((c) => c.length >= minSize);
  const small = clusters.filter((c) => c.length < minSize);
  if (small.length === 0 || large.length === 0) return clusters;

  const centroids = large.map((members) => {
    const dim = vectors[members[0]].length;
    const mean = new Array<number>(dim).fill(0);
    for (const i of members) for (let d = 0; d < dim; d++) mean[d] += vectors[i][d];
    return mean.map((x) => x / members.length);
  });

  const merged = large.map((c) => [...c]);
  for (const cluster of small) {
    for (const i of cluster) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = sqDist(vectors[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      merged[best].push(i);
    }
  }
  return merged;
}

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}
