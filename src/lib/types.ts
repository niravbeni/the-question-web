/** A large, incomplete sentence the visitor continues to open their point of view. */
export interface SentenceStarter {
  id: string;
  /** The incomplete sentence, ending with an ellipsis. */
  text: string;
  shortLabel: string;
  /** A quiet nudge under the input about what to include. */
  hint: string;
  placeholder: string;
  sortOrder: number;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** A published point of view: the unit everything else is computed from. */
export interface Pov {
  id: string;
  starterId: string;
  /** The visitor's opening paragraph (starter continuation). */
  rawInput: string;
  /** The approved, anonymized public summary of the point of view. */
  summary: string;
  topicId: string | null;
  createdAt: string;
  isSeed: boolean;
}

/** A cluster of related points of view, labeled by the analysis model. */
export interface Topic {
  id: string;
  label: string;
  summary: string;
  sortOrder: number;
}

/**
 * What the voices in each third of a tension axis hold in common, written by
 * the analysis model during recalibration. Null where nobody sits there yet.
 */
export interface TensionSections {
  left: string | null;
  center: string | null;
  right: string | null;
}

/** A creative tension: two opposing pulls that both live inside one topic. */
export interface Tension {
  id: string;
  topicId: string;
  poleA: string;
  poleB: string;
  /** One-sentence framing of what is genuinely at stake between the poles. */
  question: string;
  sortOrder: number;
  sections: TensionSections;
}

/** Where one point of view sits on one tension axis. -1 = fully pole A, 1 = fully pole B. */
export interface PovPosition {
  povId: string;
  tensionId: string;
  score: number;
}

/* ---------- Assembled read model for the landscape page ---------- */

export interface LandscapePoint {
  povId: string;
  score: number;
  summary: string;
  isSeed: boolean;
}

export interface LandscapeTension {
  id: string;
  poleA: string;
  poleB: string;
  question: string;
  sections: TensionSections;
  points: LandscapePoint[];
}

export interface LandscapeTopic {
  id: string;
  label: string;
  summary: string;
  voiceCount: number;
  tensions: LandscapeTension[];
}

/**
 * One voice placed in the whole landscape rather than on a single axis.
 * `weights` runs parallel to `Landscape.topics` and sums to 1: how strongly
 * this view pulls toward each topic, so it can be positioned inside the
 * spider chart instead of sitting on one corner.
 */
export interface SpiderPoint {
  povId: string;
  summary: string;
  topicId: string;
  weights: number[];
}

export interface Landscape {
  /** When the landscape was last recalibrated; null before the first run. */
  calibratedAt: string | null;
  totalVoices: number;
  /** Voices that arrived after the last recalibration and have no topic yet. */
  unplacedCount: number;
  topics: LandscapeTopic[];
  /** Every placed voice, positioned across all topics for the spider chart. */
  spiderPoints: SpiderPoint[];
}

/* ---------- Contribution chat protocol ---------- */

/** Payload the facilitator produces when the exchange is complete. */
export interface FinalizePovPayload {
  summary: string;
}
