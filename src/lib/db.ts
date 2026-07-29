import postgres from "postgres";
import { defaultStarters } from "@/content/starters";
import { cosine } from "@/lib/vector";
import type {
  Landscape,
  LandscapeTopic,
  Pov,
  PovPosition,
  SentenceStarter,
  Tension,
  Topic,
} from "@/lib/types";

/**
 * Postgres data layer (Supabase in production, local Postgres in dev).
 * Connection is lazy so builds succeed without a DATABASE_URL; the schema is
 * created on first use, so a fresh database works with zero manual setup.
 */

let sql: postgres.Sql | null = null;
let schemaReady: Promise<void> | null = null;

function getSql(): postgres.Sql {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Postgres database (e.g. the Supabase connection string).",
    );
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  sql = postgres(url, {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    ssl: isLocal ? false : "require",
    // Must stay comfortably above the number of queries a single page fires in
    // parallel: once every connection is busy, further queries wait on the
    // pool rather than the database, and a page that saturates it stalls.
    max: 20,
    connect_timeout: 15,
    idle_timeout: 30,
  });
  return sql;
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const s = getSql();
      await s`CREATE TABLE IF NOT EXISTS povs (
        id TEXT PRIMARY KEY,
        starter_id TEXT NOT NULL,
        raw_input TEXT NOT NULL,
        transcript TEXT NOT NULL DEFAULT '[]',
        summary TEXT NOT NULL,
        embedding TEXT,
        topic_id TEXT,
        fit DOUBLE PRECISION,
        is_seed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TEXT NOT NULL
      )`;
      await s`CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        summary TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`;
      await s`CREATE TABLE IF NOT EXISTS tensions (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL,
        pole_a TEXT NOT NULL,
        pole_b TEXT NOT NULL,
        question TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`;
      // Mean embedding of a topic's members, used to measure how strongly
      // every voice relates to every topic in the spider chart.
      await s`ALTER TABLE topics ADD COLUMN IF NOT EXISTS centroid TEXT`;
      // What the voices in each third of a tension axis hold in common.
      await s`ALTER TABLE tensions ADD COLUMN IF NOT EXISTS summary_left TEXT`;
      await s`ALTER TABLE tensions ADD COLUMN IF NOT EXISTS summary_center TEXT`;
      await s`ALTER TABLE tensions ADD COLUMN IF NOT EXISTS summary_right TEXT`;
      await s`CREATE TABLE IF NOT EXISTS positions (
        pov_id TEXT NOT NULL,
        tension_id TEXT NOT NULL,
        score DOUBLE PRECISION NOT NULL,
        PRIMARY KEY (pov_id, tension_id)
      )`;
      await s`CREATE TABLE IF NOT EXISTS calibration_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        pov_count INTEGER NOT NULL DEFAULT 0,
        note TEXT
      )`;
      await s`CREATE TABLE IF NOT EXISTS starters (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        short_label TEXT NOT NULL,
        hint TEXT NOT NULL DEFAULT '',
        placeholder TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0
      )`;
    })().catch((err) => {
      schemaReady = null; // allow retry on the next request
      throw err;
    });
  }
  return schemaReady;
}

/** Schema-ensured client: every public function goes through this. */
async function db(): Promise<postgres.Sql> {
  await ensureSchema();
  return getSql();
}

/* ---------- rows ---------- */

interface PovRow {
  id: string;
  starter_id: string;
  raw_input: string;
  transcript: string;
  summary: string;
  embedding: string | null;
  topic_id: string | null;
  is_seed: boolean;
  created_at: string;
}

interface TopicRow {
  id: string;
  label: string;
  summary: string;
  sort_order: number;
  centroid: string | null;
}

interface TensionRow {
  id: string;
  topic_id: string;
  pole_a: string;
  pole_b: string;
  question: string;
  sort_order: number;
  summary_left: string | null;
  summary_center: string | null;
  summary_right: string | null;
}

function rowToPov(r: PovRow): Pov {
  return {
    id: r.id,
    starterId: r.starter_id,
    rawInput: r.raw_input,
    summary: r.summary,
    topicId: r.topic_id,
    createdAt: r.created_at,
    isSeed: r.is_seed,
  };
}

function rowToTopic(r: TopicRow): Topic {
  return { id: r.id, label: r.label, summary: r.summary, sortOrder: r.sort_order };
}

function rowToTension(r: TensionRow): Tension {
  return {
    id: r.id,
    topicId: r.topic_id,
    poleA: r.pole_a,
    poleB: r.pole_b,
    question: r.question,
    sortOrder: r.sort_order,
    sections: {
      left: r.summary_left,
      center: r.summary_center,
      right: r.summary_right,
    },
  };
}

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/* ---------- povs ---------- */

export interface NewPov {
  id: string;
  starterId: string;
  rawInput: string;
  transcript: Array<{ role: string; content: string }>;
  summary: string;
  embedding: number[] | null;
  topicId: string | null;
  isSeed: boolean;
}

export async function insertPov(p: NewPov): Promise<void> {
  const s = await db();
  await s`INSERT INTO povs (id, starter_id, raw_input, transcript, summary, embedding, topic_id, is_seed, created_at)
    VALUES (${p.id}, ${p.starterId}, ${p.rawInput}, ${JSON.stringify(p.transcript)}, ${p.summary},
            ${p.embedding ? JSON.stringify(p.embedding) : null}, ${p.topicId}, ${p.isSeed}, ${new Date().toISOString()})`;
  invalidateLandscape();
}

export async function getAllPovs(): Promise<Pov[]> {
  const s = await db();
  const rows = await s<PovRow[]>`SELECT * FROM povs ORDER BY created_at ASC`;
  return rows.map(rowToPov);
}

export async function getPovById(id: string): Promise<Pov | null> {
  const s = await db();
  const rows = await s<PovRow[]>`SELECT * FROM povs WHERE id = ${id}`;
  return rows[0] ? rowToPov(rows[0]) : null;
}

export async function countPovs(): Promise<number> {
  const s = await db();
  const rows = await s<Array<{ n: string }>>`SELECT COUNT(*) AS n FROM povs`;
  return Number(rows[0].n);
}

/** Povs with parsed embeddings: used by the recalibration pipeline. */
export async function getPovsWithEmbeddings(): Promise<
  Array<Pov & { embedding: number[] | null }>
> {
  const s = await db();
  const rows = await s<PovRow[]>`SELECT * FROM povs`;
  return rows.map((r) => ({
    ...rowToPov(r),
    embedding: safeJson<number[] | null>(r.embedding, null),
  }));
}

export async function setPovEmbedding(id: string, embedding: number[]): Promise<void> {
  const s = await db();
  await s`UPDATE povs SET embedding = ${JSON.stringify(embedding)} WHERE id = ${id}`;
  invalidateLandscape();
}

export async function setPovTopic(id: string, topicId: string | null): Promise<void> {
  const s = await db();
  await s`UPDATE povs SET topic_id = ${topicId} WHERE id = ${id}`;
  invalidateLandscape();
}

export async function setPovFit(id: string, fit: number | null): Promise<void> {
  const s = await db();
  await s`UPDATE povs SET fit = ${fit} WHERE id = ${id}`;
  invalidateLandscape();
}

/* ---------- admin (prototype testing) ---------- */

/** Full pov rows for the admin table, including fit and raw input. */
export async function getAdminPovs(): Promise<
  Array<Pov & { fit: number | null; topicLabel: string | null }>
> {
  const s = await db();
  const rows = await s<
    Array<PovRow & { fit: number | null; topic_label: string | null }>
  >`SELECT p.*, t.label AS topic_label FROM povs p
    LEFT JOIN topics t ON t.id = p.topic_id
    ORDER BY p.created_at DESC`;
  return rows.map((r) => ({
    ...rowToPov(r),
    fit: r.fit,
    topicLabel: r.topic_label,
  }));
}

/** Edit a view's text; stale embedding/fit are cleared so they recompute. */
export async function updatePovText(
  id: string,
  summary: string,
  rawInput: string,
): Promise<void> {
  const s = await db();
  await s`UPDATE povs SET summary = ${summary}, raw_input = ${rawInput}, embedding = NULL, fit = NULL WHERE id = ${id}`;
  invalidateLandscape();
}

export async function deletePov(id: string): Promise<void> {
  const s = await db();
  await s.begin(async (tx) => {
    await tx`DELETE FROM positions WHERE pov_id = ${id}`;
    await tx`DELETE FROM povs WHERE id = ${id}`;
  });
  invalidateLandscape();
}

/** Remove every non-seed view (test data) and its positions. */
export async function deleteNonSeedPovs(): Promise<number> {
  const s = await db();
  let n = 0;
  await s.begin(async (tx) => {
    await tx`DELETE FROM positions WHERE pov_id IN (SELECT id FROM povs WHERE is_seed = FALSE)`;
    const result = await tx`DELETE FROM povs WHERE is_seed = FALSE`;
    n = result.count;
  });
  invalidateLandscape();
  return n;
}

/** Wipe every table. Follow with reseeding to restore the demo landscape. */
export async function wipeAll(): Promise<void> {
  const s = await db();
  await s.begin(async (tx) => {
    await tx`DELETE FROM positions`;
    await tx`DELETE FROM tensions`;
    await tx`DELETE FROM topics`;
    await tx`DELETE FROM povs`;
    await tx`DELETE FROM calibration_runs`;
  });
  invalidateLandscape();
}

/* ---------- topics / tensions / positions ---------- */

export async function getTopics(): Promise<Topic[]> {
  const s = await db();
  const rows = await s<TopicRow[]>`SELECT * FROM topics ORDER BY sort_order ASC`;
  return rows.map(rowToTopic);
}

/**
 * Topics plus each topic's stored mean member embedding. Both come from the
 * same rows, so the spider chart costs no extra round trip: every query the
 * landscape adds is one more connection held at once, and the pool is small.
 */
export async function getTopicsWithCentroids(): Promise<{
  topics: Topic[];
  centroids: Map<string, number[]>;
}> {
  const s = await db();
  const rows = await s<TopicRow[]>`SELECT * FROM topics ORDER BY sort_order ASC`;
  const centroids = new Map<string, number[]>();
  for (const r of rows) {
    const parsed = safeJson<number[] | null>(r.centroid, null);
    if (parsed && parsed.length > 0) centroids.set(r.id, parsed);
  }
  return { topics: rows.map(rowToTopic), centroids };
}

export async function getTensions(): Promise<Tension[]> {
  const s = await db();
  const rows = await s<TensionRow[]>`SELECT * FROM tensions ORDER BY sort_order ASC`;
  return rows.map(rowToTension);
}

export async function getTensionsByTopic(topicId: string): Promise<Tension[]> {
  const s = await db();
  const rows = await s<TensionRow[]>`SELECT * FROM tensions WHERE topic_id = ${topicId} ORDER BY sort_order ASC`;
  return rows.map(rowToTension);
}

export async function getPositions(): Promise<PovPosition[]> {
  const s = await db();
  const rows = await s<
    Array<{ pov_id: string; tension_id: string; score: number }>
  >`SELECT * FROM positions`;
  return rows.map((r) => ({ povId: r.pov_id, tensionId: r.tension_id, score: r.score }));
}

export async function upsertPosition(p: PovPosition): Promise<void> {
  const s = await db();
  await s`INSERT INTO positions (pov_id, tension_id, score)
    VALUES (${p.povId}, ${p.tensionId}, ${clampScore(p.score)})
    ON CONFLICT (pov_id, tension_id) DO UPDATE SET score = EXCLUDED.score`;
  invalidateLandscape();
}

function clampScore(score: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(score) ? score : 0));
}

/* ---------- sentence starters ---------- */

interface StarterRow {
  id: string;
  text: string;
  short_label: string;
  hint: string;
  placeholder: string;
  sort_order: number;
}

function rowToStarter(r: StarterRow): SentenceStarter {
  return {
    id: r.id,
    text: r.text,
    shortLabel: r.short_label,
    hint: r.hint,
    placeholder: r.placeholder,
    sortOrder: r.sort_order,
  };
}

/**
 * The hand-written starters in src/content/starters.ts are defaults: they are
 * inserted once into an empty table, after which the database copy is the
 * source of truth and can be edited from the admin screen.
 */
async function ensureStartersSeeded(s: postgres.Sql): Promise<void> {
  const rows = await s<Array<{ n: string }>>`SELECT COUNT(*) AS n FROM starters`;
  if (Number(rows[0].n) > 0) return;
  for (const st of defaultStarters) {
    await s`INSERT INTO starters (id, text, short_label, hint, placeholder, sort_order)
      VALUES (${st.id}, ${st.text}, ${st.shortLabel}, ${st.hint}, ${st.placeholder}, ${st.sortOrder})
      ON CONFLICT (id) DO NOTHING`;
  }
}

export async function getStarters(): Promise<SentenceStarter[]> {
  const s = await db();
  await ensureStartersSeeded(s);
  const rows = await s<StarterRow[]>`SELECT * FROM starters ORDER BY sort_order ASC`;
  return rows.map(rowToStarter);
}

export async function getStarterById(id: string): Promise<SentenceStarter | null> {
  const s = await db();
  await ensureStartersSeeded(s);
  const rows = await s<StarterRow[]>`SELECT * FROM starters WHERE id = ${id}`;
  return rows[0] ? rowToStarter(rows[0]) : null;
}

export async function updateStarter(
  id: string,
  fields: { text: string; shortLabel: string; placeholder: string },
): Promise<void> {
  const s = await db();
  await s`UPDATE starters
    SET text = ${fields.text}, short_label = ${fields.shortLabel}, placeholder = ${fields.placeholder}
    WHERE id = ${id}`;
}

/** Restore all starters to the hand-written defaults. */
export async function resetStarters(): Promise<void> {
  const s = await db();
  await s.begin(async (tx) => {
    await tx`DELETE FROM starters`;
    for (const st of defaultStarters) {
      await tx`INSERT INTO starters (id, text, short_label, hint, placeholder, sort_order)
        VALUES (${st.id}, ${st.text}, ${st.shortLabel}, ${st.hint}, ${st.placeholder}, ${st.sortOrder})`;
    }
  });
}

/* ---------- calibration runs ---------- */

export interface CalibrationResult {
  runId: string;
  topics: Array<{
    topic: Topic;
    /** Mean embedding of this topic's members; null when unavailable. */
    centroid: number[] | null;
    tensions: Tension[];
    memberPovIds: string[];
    positions: PovPosition[];
  }>;
}

/** Atomically replace the live landscape with the output of a calibration run. */
export async function commitCalibration(result: CalibrationResult): Promise<void> {
  const s = await db();
  const now = new Date().toISOString();
  await s.begin(async (tx) => {
    await tx`DELETE FROM topics`;
    await tx`DELETE FROM tensions`;
    await tx`DELETE FROM positions`;
    await tx`UPDATE povs SET topic_id = NULL`;

    let povTotal = 0;
    for (const t of result.topics) {
      await tx`INSERT INTO topics (id, label, summary, sort_order, centroid)
        VALUES (${t.topic.id}, ${t.topic.label}, ${t.topic.summary}, ${t.topic.sortOrder},
                ${t.centroid ? JSON.stringify(t.centroid) : null})`;
      for (const tn of t.tensions) {
        await tx`INSERT INTO tensions (id, topic_id, pole_a, pole_b, question, sort_order,
                                      summary_left, summary_center, summary_right)
          VALUES (${tn.id}, ${tn.topicId}, ${tn.poleA}, ${tn.poleB}, ${tn.question}, ${tn.sortOrder},
                  ${tn.sections.left}, ${tn.sections.center}, ${tn.sections.right})`;
      }
      for (const povId of t.memberPovIds) {
        await tx`UPDATE povs SET topic_id = ${t.topic.id} WHERE id = ${povId}`;
        povTotal++;
      }
      for (const p of t.positions) {
        await tx`INSERT INTO positions (pov_id, tension_id, score)
          VALUES (${p.povId}, ${p.tensionId}, ${clampScore(p.score)})
          ON CONFLICT (pov_id, tension_id) DO UPDATE SET score = EXCLUDED.score`;
      }
    }

    await tx`INSERT INTO calibration_runs (id, started_at, completed_at, status, pov_count)
      VALUES (${result.runId}, ${now}, ${now}, 'complete', ${povTotal})`;
  });
  invalidateLandscape();
}

export async function getLastCalibration(): Promise<{
  id: string;
  completedAt: string;
} | null> {
  const s = await db();
  const rows = await s<Array<{ id: string; completed_at: string }>>`
    SELECT id, completed_at FROM calibration_runs
    WHERE status = 'complete' ORDER BY completed_at DESC LIMIT 1`;
  return rows[0] ? { id: rows[0].id, completedAt: rows[0].completed_at } : null;
}

/** How many povs arrived after the last completed calibration. */
export async function countPovsSinceLastCalibration(): Promise<number> {
  const last = await getLastCalibration();
  if (!last) return countPovs();
  const s = await db();
  const rows = await s<
    Array<{ n: string }>
  >`SELECT COUNT(*) AS n FROM povs WHERE created_at > ${last.completedAt}`;
  return Number(rows[0].n);
}

/**
 * Drift signal: how many voices since the last calibration either found no
 * topic at all or fit their assigned topic poorly. When these accumulate, the
 * data is leaning somewhere the current landscape does not cover.
 */
export async function countPoorFitsSinceLastCalibration(
  threshold: number,
): Promise<number> {
  const last = await getLastCalibration();
  const since = last?.completedAt ?? "";
  const s = await db();
  const rows = await s<Array<{ n: string }>>`
    SELECT COUNT(*) AS n FROM povs
    WHERE created_at > ${since} AND is_seed = FALSE
      AND (topic_id IS NULL OR (fit IS NOT NULL AND fit < ${threshold}))`;
  return Number(rows[0].n);
}

/* ---------- assembled landscape ---------- */

/**
 * How strongly one voice pulls toward its own topic versus the others. Its
 * own topic always wins, so the voice sits nearest the corner you would click
 * to read it, but genuine affinity with other topics pulls it inward.
 */
const HOME_PULL = 0.25;
/**
 * Raises the contrast between a voice's stronger and weaker affinities. Kept
 * low: sharpening hard makes every voice a near-perfect match for its own
 * topic, which collapses the whole chart onto its corners.
 */
const AFFINITY_CONTRAST = 2;

/**
 * Weights across every topic for one voice, summing to 1. Similarities inside
 * a single subject area sit in a narrow band, so they are stretched across
 * their own range before being sharpened: what matters is which topics this
 * voice is relatively closest to, not the absolute cosine values.
 */
function spiderWeights(
  embedding: number[] | null,
  centroids: Array<number[] | null>,
  homeIndex: number,
): number[] {
  const n = centroids.length;
  if (n === 0) return [];

  const sims = centroids.map((c) => (embedding && c ? cosine(embedding, c) : 0));
  const min = Math.min(...sims);
  const span = Math.max(...sims) - min;
  const raw =
    span > 1e-6
      ? sims.map((s) => Math.pow((s - min) / span, AFFINITY_CONTRAST))
      : new Array<number>(n).fill(1);

  const total = raw.reduce((a, b) => a + b, 0);
  const affinity = total > 0 ? raw.map((x) => x / total) : raw.map(() => 1 / n);

  if (homeIndex < 0) return affinity;
  return affinity.map(
    (x, i) => x * (1 - HOME_PULL) + (i === homeIndex ? HOME_PULL : 0),
  );
}

/**
 * The assembled landscape is the same for every visitor and costs five queries,
 * so readers share one in-flight read instead of each opening their own
 * connections. Writes clear it, and the short life is only a backstop for
 * anything that changes the data without going through this module.
 */
const LANDSCAPE_TTL_MS = 5_000;
let landscapeCache: { at: number; value: Promise<Landscape> } | null = null;

/** Drop the shared landscape so the next read sees the write that just landed. */
export function invalidateLandscape(): void {
  landscapeCache = null;
}

export async function getLandscape(): Promise<Landscape> {
  const cached = landscapeCache;
  if (cached && Date.now() - cached.at < LANDSCAPE_TTL_MS) return cached.value;

  const value = buildLandscape();
  const entry = { at: Date.now(), value };
  landscapeCache = entry;
  // A read that fails must not be handed to everyone who asks next.
  value.catch(() => {
    if (landscapeCache === entry) landscapeCache = null;
  });
  return value;
}

async function buildLandscape(): Promise<Landscape> {
  const [povs, topicData, tensions, positions, last] = await Promise.all([
    getPovsWithEmbeddings(),
    getTopicsWithCentroids(),
    getTensions(),
    getPositions(),
    getLastCalibration(),
  ]);
  const { topics, centroids } = topicData;

  const povById = new Map(povs.map((p) => [p.id, p]));
  const positionsByTension = new Map<string, PovPosition[]>();
  for (const p of positions) {
    const list = positionsByTension.get(p.tensionId) ?? [];
    list.push(p);
    positionsByTension.set(p.tensionId, list);
  }

  const landscapeTopics: LandscapeTopic[] = topics.map((topic) => {
    const members = povs.filter((p) => p.topicId === topic.id);
    const topicTensions = tensions
      .filter((t) => t.topicId === topic.id)
      .map((t) => ({
        id: t.id,
        poleA: t.poleA,
        poleB: t.poleB,
        question: t.question,
        sections: t.sections,
        points: (positionsByTension.get(t.id) ?? [])
          .map((p) => {
            const pov = povById.get(p.povId);
            if (!pov) return null;
            return {
              povId: p.povId,
              score: p.score,
              summary: pov.summary,
              isSeed: pov.isSeed,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .sort((a, b) => a.score - b.score),
      }));
    return {
      id: topic.id,
      label: topic.label,
      summary: topic.summary,
      voiceCount: members.length,
      tensions: topicTensions,
    };
  });

  // Topics are ordered by size for display; the spider chart's corners follow
  // that same order, so weights are computed against the sorted list.
  const sortedTopics = landscapeTopics.sort((a, b) => b.voiceCount - a.voiceCount);
  const centroidList = sortedTopics.map((t) => centroids.get(t.id) ?? null);
  const topicIndex = new Map(sortedTopics.map((t, i) => [t.id, i]));

  const spiderPoints = povs
    .filter((p) => p.topicId !== null && topicIndex.has(p.topicId))
    .map((p) => ({
      povId: p.id,
      summary: p.summary,
      topicId: p.topicId as string,
      weights: spiderWeights(
        p.embedding,
        centroidList,
        topicIndex.get(p.topicId as string) ?? -1,
      ),
    }));

  return {
    calibratedAt: last?.completedAt ?? null,
    totalVoices: povs.length,
    unplacedCount: povs.filter((p) => p.topicId === null).length,
    topics: sortedTopics,
    spiderPoints,
  };
}
