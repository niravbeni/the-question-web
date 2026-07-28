import { seedPovs, seedTopics } from "@/content/seed";
import { commitCalibration, countPovs, insertPov, wipeAll } from "@/lib/db";
import type { PovPosition } from "@/lib/types";

let seeded = false;

/** Admin reset: wipe everything and restore the hand-written seed landscape. */
export async function resetToSeeds(): Promise<void> {
  await wipeAll();
  seeded = false;
  await ensureSeeded();
}

/**
 * Idempotently populate an empty database with the hand-written seed landscape:
 * povs, topics, tensions, and positions, recorded as a completed calibration
 * run. The first real recalibration replaces the structure entirely.
 */
export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  if ((await countPovs()) > 0) {
    seeded = true;
    return;
  }

  for (const pov of seedPovs) {
    await insertPov({
      id: pov.id,
      starterId: pov.starterId,
      rawInput: pov.rawInput,
      transcript: [],
      summary: pov.summary,
      embedding: null,
      topicId: null, // assigned by commitCalibration below
      isSeed: true,
    });
  }

  await commitCalibration({
    runId: "seed-run",
    topics: seedTopics.map((topic) => {
      const members = seedPovs.filter((p) => p.topicId === topic.id);
      const positions: PovPosition[] = [];
      for (const pov of members) {
        for (const [tensionId, score] of Object.entries(pov.scores)) {
          positions.push({ povId: pov.id, tensionId, score });
        }
      }
      return {
        topic: {
          id: topic.id,
          label: topic.label,
          summary: topic.summary,
          sortOrder: topic.sortOrder,
        },
        tensions: topic.tensions.map((t) => ({
          id: t.id,
          topicId: topic.id,
          poleA: t.poleA,
          poleB: t.poleB,
          question: t.question,
          sortOrder: t.sortOrder,
        })),
        memberPovIds: members.map((p) => p.id),
        positions,
      };
    }),
  });

  seeded = true;
}
