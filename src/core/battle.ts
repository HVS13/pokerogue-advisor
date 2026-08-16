import type {
  AdvisorRecommendation,
  BattleMoveCandidate,
  DecisionStrength,
} from "./types.js";

function getBattleDecisionStrength(best: BattleMoveCandidate, second?: BattleMoveCandidate): DecisionStrength {
  if (!second) return "strong";

  const gap = best.plannerScore - second.plannerScore;
  const scale = Math.max(Math.abs(best.plannerScore), 20);
  const relativeGap = gap / scale;

  if (gap <= 2 || relativeGap <= 0.03) return "equivalent";
  if (gap <= 8 || relativeGap <= 0.1) return "slight";
  if (gap <= 20 || relativeGap <= 0.25) return "moderate";
  return "strong";
}

function formatMoveLabel(move: BattleMoveCandidate): string {
  return move.target ? `${move.name} → ${move.target}` : move.name;
}

function buildDecision(sorted: BattleMoveCandidate[]): AdvisorRecommendation | undefined {
  const best = sorted[0];
  if (!best) return;

  const second = sorted[1];
  const strength = getBattleDecisionStrength(best, second);
  const reasons = [
    ...(best.reasons ?? []),
    `Planner score: ${best.plannerScore.toFixed(1)}${second ? ` vs ${second.plannerScore.toFixed(1)} next-best` : ""}.`,
  ];

  if (second && strength === "equivalent") {
    reasons.push(`${formatMoveLabel(second)} is effectively tied; either choice is reasonable.`);
  } else if (second && strength === "slight") {
    reasons.push(`${formatMoveLabel(second)} is a reasonable alternative with only a small planner gap.`);
  }

  if (best.expectedDamageMin !== undefined && best.expectedDamageMax !== undefined) {
    reasons.push(`Estimated damage: ${best.expectedDamageMin.toFixed(0)}-${best.expectedDamageMax.toFixed(0)}%.`);
  }
  if (best.koChance !== undefined) {
    reasons.push(`Estimated KO chance: ${(best.koChance * 100).toFixed(0)}%.`);
  }

  return {
    id: `battle:decision:${best.id}`,
    label: `USE ${formatMoveLabel(best).toUpperCase()}`,
    score: best.plannerScore,
    isDecision: true,
    decisionStrength: strength,
    reason: reasons,
    warnings: best.warnings,
    metadata: {
      moveId: best.id,
      target: best.target ?? "",
      plannerScore: best.plannerScore,
    },
  };
}

export function analyzeBattleMoves(moves: BattleMoveCandidate[]): AdvisorRecommendation[] {
  const sorted = [...moves].sort((a, b) => b.plannerScore - a.plannerScore);
  const decision = buildDecision(sorted);
  const evidence = sorted.map((move, index) => ({
    id: `move:${move.id}:${move.target ?? ""}`,
    label: formatMoveLabel(move),
    score: move.plannerScore,
    rank: index + 1,
    reason: [
      ...(move.reasons ?? []),
      ...(move.expectedDamageMin !== undefined && move.expectedDamageMax !== undefined
        ? [`Estimated damage: ${move.expectedDamageMin.toFixed(0)}-${move.expectedDamageMax.toFixed(0)}%`]
        : []),
      ...(move.koChance !== undefined ? [`Estimated KO chance: ${(move.koChance * 100).toFixed(0)}%`] : []),
    ],
    warnings: move.warnings,
    metadata: { target: move.target ?? "", plannerScore: move.plannerScore },
  } satisfies AdvisorRecommendation));

  return decision ? [decision, ...evidence] : evidence;
}
