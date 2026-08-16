export type AdvisorContext = "battle" | "capture" | "reward" | "shop" | "party" | "idle";

export interface AdvisorRecommendation {
  id: string;
  label: string;
  score: number;
  rank?: number;
  confidence?: number;
  probability?: number;
  reason: string[];
  warnings?: string[];
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
}

export interface CaptureSnapshot {
  speciesName: string;
  hp: number;
  maxHp: number;
  catchRate: number;
  statusMultiplier: number;
  shinyMultiplier: number;
  /** Probability from 0 to 1, not the game's raw 0..255/256 critical-capture value. */
  criticalCaptureProbability: number;
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
  capture?: CaptureSnapshot;
  rewards?: ChoiceCandidate[];
  shop?: ChoiceCandidate[];
  generatedAt: number;
}
