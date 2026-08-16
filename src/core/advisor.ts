import { analyzeBattleMoves } from "./battle.js";
import { assessCatchValue } from "./catch-value.js";
import { analyzeCapture } from "./capture.js";
import { analyzeRewardShop, rankChoices } from "./choices.js";
import type { AdvisorRecommendation, AdvisorSnapshot, CaptureSnapshot } from "./types.js";

function analyzeCaptureTarget(target: CaptureSnapshot): AdvisorRecommendation[] {
  const assessment = assessCatchValue(target);
  const enrichedTarget = assessment
    ? {
        ...target,
        teamFitScore: assessment.score,
        replacementName: assessment.replacementName ?? target.replacementName,
      }
    : target;

  const recommendations = analyzeCapture(enrichedTarget);
  if (assessment) {
    const catchValue = recommendations.find(recommendation => recommendation.id.endsWith(":team-fit"));
    if (catchValue) {
      catchValue.reason = [
        `Team fit: ${assessment.score.toFixed(0)}/100`,
        ...assessment.reasons,
        ...(assessment.replacementName ? [`Potential replacement: ${assessment.replacementName}`] : []),
      ];
    }
  }
  return recommendations;
}

function analyzeCaptureTargets(targets: CaptureSnapshot[]): AdvisorRecommendation[] {
  const multipleTargets = targets.length > 1;
  const recommendations = targets.flatMap(target =>
    analyzeCaptureTarget(target).map(recommendation => ({
      ...recommendation,
      label: multipleTargets && !recommendation.label.startsWith("Catch value:")
        ? `${target.speciesName} · ${recommendation.label}`
        : recommendation.label,
    })),
  );

  return [
    ...recommendations.filter(recommendation => recommendation.isDecision),
    ...recommendations.filter(recommendation => !recommendation.isDecision && recommendation.id.endsWith(":team-fit")),
    ...recommendations.filter(recommendation => !recommendation.isDecision && !recommendation.id.endsWith(":team-fit")),
  ];
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
    case "reward-shop":
      return analyzeRewardShop(
        snapshot.rewards ?? [],
        snapshot.shop ?? [],
        snapshot.shopMoney,
        snapshot.shopReserve,
      );
    case "reward":
      return rankChoices("reward", snapshot.rewards ?? []);
    case "shop":
      return rankChoices("shop", snapshot.shop ?? []);
    default:
      return [];
  }
}
