import type {
  AdvisorRecommendation,
  CaptureBallCandidate,
  CaptureSnapshot,
  DecisionStrength,
} from "./types.js";

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Generic fallback calculator. Game adapters should send per-ball probability when they can,
 * because some PokeRogue builds make critical-capture chance depend on modified catch rate.
 */
export function getCaptureProbability(
  snapshot: CaptureSnapshot,
  ball: CaptureBallCandidate,
): number {
  if (ball.probability !== undefined) return clamp01(ball.probability);
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
  const criticalChance = clamp01(snapshot.criticalCaptureProbability ?? 0);

  return criticalChance * shakeChance + (1 - criticalChance) * Math.pow(shakeChance, 3);
}

interface EvaluatedBall {
  ball: CaptureBallCandidate;
  probability: number;
  resourceRank: number;
}

function getResourceRank(ball: CaptureBallCandidate): number {
  if (ball.resourceRank !== undefined) return ball.resourceRank;

  const parsedId = Number(ball.id);
  return Number.isFinite(parsedId) ? parsedId : Math.max(ball.multiplier, 0);
}

function getEquivalenceMargin(bestProbability: number): number {
  if (bestProbability >= 0.95) return 0.03;
  if (bestProbability >= 0.8) return 0.02;
  if (bestProbability >= 0.6) return 0.01;
  return 0.005;
}

function choosePracticalBall(evaluated: EvaluatedBall[], teamFitScore?: number): {
  chosen: EvaluatedBall;
  highestProbability: EvaluatedBall;
  equivalent: EvaluatedBall[];
  preservedPremium: boolean;
} | undefined {
  if (evaluated.length === 0) return;

  const byProbability = [...evaluated].sort((a, b) =>
    b.probability - a.probability
    || a.resourceRank - b.resourceRank
    || b.ball.count - a.ball.count,
  );

  const nonPremium = byProbability.filter(candidate => candidate.resourceRank < 4);
  const hasPremium = byProbability.some(candidate => candidate.resourceRank >= 4);
  const shouldPreservePremium = hasPremium && nonPremium.length > 0 && (teamFitScore === undefined || teamFitScore < 90);
  const practicalPool = shouldPreservePremium ? nonPremium : byProbability;
  const highestProbability = practicalPool[0];
  const margin = getEquivalenceMargin(highestProbability.probability);
  const equivalent = practicalPool.filter(
    candidate => highestProbability.probability - candidate.probability <= margin,
  );

  const chosen = [...equivalent].sort((a, b) =>
    a.resourceRank - b.resourceRank
    || b.ball.count - a.ball.count
    || b.probability - a.probability,
  )[0];

  return { chosen, highestProbability, equivalent, preservedPremium: shouldPreservePremium };
}

function getDecisionStrength(
  chosen: EvaluatedBall,
  highestProbability: EvaluatedBall,
  equivalentCount: number,
): DecisionStrength {
  if (equivalentCount > 1 && chosen.ball.id !== highestProbability.ball.id) return "equivalent";
  if (chosen.probability >= 0.9) return "strong";
  if (chosen.probability >= 0.7) return "moderate";
  if (chosen.probability >= 0.45) return "slight";
  return "situational";
}

function buildCaptureDecision(
  snapshot: CaptureSnapshot,
  evaluated: EvaluatedBall[],
): AdvisorRecommendation | undefined {
  const selection = choosePracticalBall(evaluated, snapshot.teamFitScore);
  if (!selection) return;

  const { chosen, highestProbability, equivalent, preservedPremium } = selection;
  const probabilityGap = highestProbability.probability - chosen.probability;
  const reasons = [`${(chosen.probability * 100).toFixed(1)}% estimated catch chance`];

  if (probabilityGap > 0) {
    reasons.push(
      `Only ${(probabilityGap * 100).toFixed(1)} percentage points below ${highestProbability.ball.name}; preserve the rarer ball.`,
    );
  } else if (equivalent.length > 1) {
    reasons.push("Several balls are practically equivalent; prefer the cheaper resource.");
  } else {
    reasons.push("Best practical catch chance among your available balls.");
  }

  if (preservedPremium) {
    reasons.push("Preserve Master-tier resources until the target-value system says they are justified.");
  }

  if (chosen.ball.count <= 2) {
    reasons.push(`Only ${chosen.ball.count} ${chosen.ball.name}${chosen.ball.count === 1 ? "" : "s"} remaining.`);
  }

  return {
    id: `capture:${snapshot.targetId ?? snapshot.speciesName}:decision`,
    label: `USE ${chosen.ball.name.toUpperCase()} NOW`,
    score: chosen.probability * 100,
    probability: chosen.probability,
    isDecision: true,
    decisionStrength: getDecisionStrength(chosen, highestProbability, equivalent.length),
    reason: reasons,
    metadata: {
      ballId: chosen.ball.id,
      targetId: snapshot.targetId ?? null,
      targetName: snapshot.speciesName,
    },
  };
}

export function analyzeCapture(snapshot: CaptureSnapshot): AdvisorRecommendation[] {
  const evaluated: EvaluatedBall[] = snapshot.balls
    .filter(ball => ball.count > 0)
    .map(ball => ({
      ball,
      probability: getCaptureProbability(snapshot, ball),
      resourceRank: getResourceRank(ball),
    }));

  const decision = buildCaptureDecision(snapshot, evaluated);

  const ballResults: AdvisorRecommendation[] = evaluated
    .map(({ ball, probability, resourceRank }) => {
      const inventoryScarcity = ball.count <= 1 ? 8 : ball.count <= 3 ? 3 : 0;
      const resourcePenalty = resourceRank * 0.5;
      return {
        id: `capture:${snapshot.targetId ?? snapshot.speciesName}:${ball.id}`,
        label: ball.name,
        score: probability * 100 - inventoryScarcity - resourcePenalty,
        probability,
        reason: [
          `${(probability * 100).toFixed(1)}% estimated catch chance`,
          `${ball.count} remaining`,
        ],
        metadata: {
          ballId: ball.id,
          count: ball.count,
          resourceRank,
          targetId: snapshot.targetId ?? null,
          targetName: snapshot.speciesName,
        },
      } satisfies AdvisorRecommendation;
    })
    .sort((a, b) => b.score - a.score);

  ballResults.forEach((result, index) => { result.rank = index + 1; });

  const output: AdvisorRecommendation[] = decision ? [decision] : [];

  if (snapshot.teamFitScore !== undefined) {
    const fitScore = Math.min(Math.max(snapshot.teamFitScore, 0), 100);
    output.push({
      id: `capture:${snapshot.targetId ?? snapshot.speciesName}:team-fit`,
      label: `Catch value: ${snapshot.speciesName}`,
      score: fitScore,
      reason: [
        `Team fit: ${fitScore.toFixed(0)}/100`,
        ...(snapshot.replacementName ? [`Potential replacement: ${snapshot.replacementName}`] : []),
      ],
      metadata: {
        teamFitScore: fitScore,
        replacementName: snapshot.replacementName ?? null,
        targetId: snapshot.targetId ?? null,
        targetName: snapshot.speciesName,
      },
    });
  }

  return [...output, ...ballResults];
}
