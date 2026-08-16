import type { AdvisorRecommendation, BattleMoveCandidate } from "./types.js";

function softmax(values: number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const exp = values.map(value => Math.exp((value - max) / 24));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map(value => value / total);
}

export function analyzeBattleMoves(moves: BattleMoveCandidate[]): AdvisorRecommendation[] {
  const sorted = [...moves].sort((a, b) => b.plannerScore - a.plannerScore);
  const confidence = softmax(sorted.map(move => move.plannerScore));

  return sorted.map((move, index) => ({
    id: `move:${move.id}`,
    label: move.name,
    score: move.plannerScore,
    rank: index + 1,
    confidence: confidence[index],
    reason: [
      ...(move.reasons ?? []),
      ...(move.expectedDamageMin !== undefined && move.expectedDamageMax !== undefined
        ? [`Estimated damage: ${move.expectedDamageMin.toFixed(0)}-${move.expectedDamageMax.toFixed(0)}%`]
        : []),
      ...(move.koChance !== undefined ? [`Estimated KO chance: ${(move.koChance * 100).toFixed(0)}%`] : []),
    ],
    warnings: move.warnings,
    metadata: { target: move.target ?? "" },
  }));
}
