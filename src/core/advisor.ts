import { analyzeBattleMoves } from "./battle.js";
import { analyzeCapture } from "./capture.js";
import { rankChoices } from "./choices.js";
import type { AdvisorRecommendation, AdvisorSnapshot } from "./types.js";

export function analyzeSnapshot(snapshot: AdvisorSnapshot): AdvisorRecommendation[] {
  switch (snapshot.context) {
    case "battle":
      return snapshot.battle ? analyzeBattleMoves(snapshot.battle.moves) : [];
    case "capture":
      return snapshot.capture ? analyzeCapture(snapshot.capture) : [];
    case "reward":
      return rankChoices("reward", snapshot.rewards ?? []);
    case "shop":
      return rankChoices("shop", snapshot.shop ?? []);
    default:
      return [];
  }
}
