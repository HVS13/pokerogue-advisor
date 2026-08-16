export type AdvisorContext = "battle" | "capture" | "reward" | "shop" | "party" | "idle";
export type DecisionStrength = "strong" | "moderate" | "slight" | "equivalent" | "situational";

export interface AdvisorRecommendation {
  id: string;
  label: string;
  score: number;
  rank?: number;
  confidence?: number;
  probability?: number;
  reason: string[];
  warnings?: string[];
  /** True when this row is the advisor's action, not merely supporting evidence. */
  isDecision?: boolean;
  decisionStrength?: DecisionStrength;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface BattleMoveCandidate {
  id: string;
  name: string;
  plannerScore: number;
  expectedDamageMin?: number;
  expectedDamageMax?: number;
  koChance?: number;
  target?: string;
  reasons?: string[];
  warnings?: string[];
}

export interface CaptureBallCandidate {
  id: string;
  name: string;
  multiplier: number;
  count: number;
  /** Exact probability from 0 to 1 when supplied by a game adapter. */
  probability?: number;
  /** Relative resource value. Lower means cheaper/more expendable. */
  resourceRank?: number;
}

export interface CaptureSnapshot {
  /** Stable target id from the game when available. */
  targetId?: number;
  speciesName: string;
  hp: number;
  maxHp: number;
  catchRate: number;
  statusMultiplier: number;
  shinyMultiplier: number;
  /**
   * Fallback critical-capture probability from 0 to 1.
   * Prefer per-ball `probability` from the game adapter because critical chance can vary by ball.
   */
  criticalCaptureProbability?: number;
  balls: CaptureBallCandidate[];
  /** Team-fit score from 0 to 100. */
  teamFitScore?: number;
  replacementName?: string;
}

export interface ChoiceCandidate {
  id: string;
  name: string;
  score: number;
  reason?: string;
  cost?: number;
  target?: string;
}

export interface AdvisorSnapshot {
  version: 1;
  context: AdvisorContext;
  battle?: {
    actorName: string;
    opponentNames: string[];
    moves: BattleMoveCandidate[];
  };
  /** Single-target compatibility field. */
  capture?: CaptureSnapshot;
  /** Preferred capture representation when more than one enemy can be targeted. */
  captureTargets?: CaptureSnapshot[];
  rewards?: ChoiceCandidate[];
  shop?: ChoiceCandidate[];
  /** Human-readable bridge/install state for idle snapshots. */
  notice?: string;
  generatedAt: number;
}
