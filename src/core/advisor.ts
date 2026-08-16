import { analyzeBattleMoves } from "./battle.js";
import { analyzeCapture } from "./capture.js";
import { rankChoices } from "./choices.js";
import type { AdvisorRecommendation, AdvisorSnapshot, CaptureSnapshot } from "./types.js";

function analyzeCaptureTargets(targets: CaptureSnapshot[]): AdvisorRecommendation[] {
  const multipleTargets = targets.length > 1;

  return targets.flatMap(target =>
    analyzeCapture(target).map(recommendation => ({
      ...recommendation,
      label: multipleTargets && !recommendation.label.startsWith("Catch value:")
        ? `${target.speciesName} · ${recommendation.label}`
        : recommendation.label,
    })),
  );
}

export function analyzeSnapshot(snapshot: AdvisorSnapshot): AdvisorRecommendation[] {
  switch (snapshot.context) {
    case "battle":
      return snapshot.battle ? analyzeBattleMoves(snapshot.battle.moves) : [];
    case "capture": {
      const targets = snapshot.captureTargets?.length
        ? snapshot.captureTargets
        : snapshot.capture
          ? [snapshot.capture]
          : [];
      return analyzeCaptureTargets(targets);
    }
    case "reward":
      return rankChoices("reward", snapshot.rewards ?? []);
    case "shop":
      return rankChoices("shop", snapshot.shop ?? []);
    default:
      return [];
  }
}
