import type { AdvisorRecommendation, CaptureBallCandidate, CaptureSnapshot } from "./types.js";

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function getCaptureProbability(
  snapshot: CaptureSnapshot,
  ball: CaptureBallCandidate,
): number {
  if (ball.multiplier < 0) return 1;
  if (ball.count <= 0 || snapshot.maxHp <= 0) return 0;

  const hpFactor = Math.max(3 * snapshot.maxHp - 2 * snapshot.hp, 1) / (3 * snapshot.maxHp);
  const modifiedCatchRate = Math.round(
    hpFactor
      * snapshot.catchRate
      * ball.multiplier
      * snapshot.statusMultiplier
      * snapshot.shinyMultiplier,
  );

  if (modifiedCatchRate >= 255) return 1;
  if (modifiedCatchRate <= 0) return 0;

  const shakeProbability = Math.round(65536 / Math.pow(255 / modifiedCatchRate, 0.1875));
  const shakeChance = clamp01(shakeProbability / 65536);
  const criticalChance = clamp01(snapshot.criticalCaptureProbability);

  return criticalChance * shakeChance + (1 - criticalChance) * Math.pow(shakeChance, 3);
}

export function analyzeCapture(snapshot: CaptureSnapshot): AdvisorRecommendation[] {
  const ballResults: AdvisorRecommendation[] = snapshot.balls
    .filter(ball => ball.count > 0)
    .map(ball => {
      const probability = getCaptureProbability(snapshot, ball);
      const scarcityPenalty = ball.count <= 1 ? 0.08 : ball.count <= 3 ? 0.03 : 0;
      const utilityScore = probability - scarcityPenalty;
      return {
        id: `capture:${ball.id}`,
        label: ball.name,
        score: utilityScore * 100,
        probability,
        reason: [
          `${(probability * 100).toFixed(1)}% estimated catch chance`,
          `${ball.count} remaining`,
        ],
        metadata: { ballId: ball.id, count: ball.count },
      } satisfies AdvisorRecommendation;
    })
    .sort((a, b) => b.score - a.score);

  ballResults.forEach((result, index) => { result.rank = index + 1; });

  if (snapshot.teamFitScore === undefined) return ballResults;

  const fitScore = Math.min(Math.max(snapshot.teamFitScore, 0), 100);
  const fit: AdvisorRecommendation = {
    id: "capture:team-fit",
    label: `Catch value: ${snapshot.speciesName}`,
    score: fitScore,
    reason: [
      `Team fit: ${fitScore.toFixed(0)}/100`,
      ...(snapshot.replacementName ? [`Potential replacement: ${snapshot.replacementName}`] : []),
    ],
    metadata: { teamFitScore: fitScore, replacementName: snapshot.replacementName ?? null },
  };

  return [fit, ...ballResults];
}
