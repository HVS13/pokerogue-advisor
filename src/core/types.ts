export type AdvisorContext = "battle" | "capture" | "reward" | "shop" | "reward-shop" | "party" | "idle";
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

export type CapturePreparationKind = "weaken" | "status";

/**
 * One safe, adapter-observed action that can improve a later capture attempt.
 * Projected balls are adapter-calculated because critical-capture chance can vary per ball.
 */
export interface CapturePreparationOption {
  kind: CapturePreparationKind;
  moveIndex: number;
  moveName: string;
  projectedBalls: CaptureBallCandidate[];
  /** Approximate chance the preparation succeeds, including move accuracy when known. */
  successProbability?: number;
  /** Approximate fraction of the target's current HP removed by the move. */
  estimatedDamageRatio?: number;
  projectedHp?: number;
  statusName?: string;
  statusMultiplier?: number;
  warning?: string;
}

/** Minimal, game-agnostic facts used to judge whether a catch improves the party. */
export interface CapturePartyMember {
  speciesId?: number;
  name: string;
  baseStatTotal: number;
  /** Numeric game type ids. The core only compares equality, so adapters need not share an enum package. */
  types: number[];
}

export interface CaptureSnapshot {
  /** Stable target id from the game when available. */
  targetId?: number;
  targetSpeciesId?: number;
  speciesName: string;
  hp: number;
  maxHp: number;
  catchRate: number;
  statusMultiplier: number;
  shinyMultiplier: number;
  isShiny?: boolean;
  targetBaseStatTotal?: number;
  targetTypes?: number[];
  party?: CapturePartyMember[];
  partyCapacity?: number;
  /** Current active player's HP ratio, used as a conservative extra-turn risk signal. */
  activeHpRatio?: number;
  /**
   * Fallback critical-capture probability from 0 to 1.
   * Prefer per-ball `probability` from the game adapter because critical chance can vary by ball.
   */
  criticalCaptureProbability?: number;
  balls: CaptureBallCandidate[];
  /** Safe one-turn preparation options observed by the game adapter. */
  preparations?: CapturePreparationOption[];
  /** Optional adapter override. Prefer portable party facts when available. */
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
  emergency?: boolean;
  reserveCost?: number;
  moneyAfterPurchase?: number;
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
  shopMoney?: number;
  shopReserve?: number;
  /** Human-readable bridge/install state for idle snapshots. */
  notice?: string;
  generatedAt: number;
}
