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

/** A creative tension: two opposing pulls that both live inside one topic. */
export interface Tension {
  id: string;
  topicId: string;
  poleA: string;
  poleB: string;
  /** One-sentence framing of what is genuinely at stake between the poles. */
  question: string;
  sortOrder: number;
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
  points: LandscapePoint[];
}

export interface LandscapeTopic {
  id: string;
  label: string;
  summary: string;
  voiceCount: number;
  tensions: LandscapeTension[];
}

export interface Landscape {
  /** When the landscape was last recalibrated; null before the first run. */
  calibratedAt: string | null;
  totalVoices: number;
  /** Voices that arrived after the last recalibration and have no topic yet. */
  unplacedCount: number;
  topics: LandscapeTopic[];
}

/* ---------- Contribution chat protocol ---------- */

/** Payload the facilitator produces when the exchange is complete. */
export interface FinalizePovPayload {
  summary: string;
}
