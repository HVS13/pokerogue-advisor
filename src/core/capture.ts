import type {
  AdvisorRecommendation,
  CaptureBallCandidate,
  CapturePreparationOption,
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

interface BallSelection {
  chosen: EvaluatedBall;
  highestProbability: EvaluatedBall;
  equivalent: EvaluatedBall[];
  preservedPremium: boolean;
}

interface EvaluatedPreparation {
  option: CapturePreparationOption;
  selection: BallSelection;
  expectedProbability: number;
  rawImprovement: number;
  utilityGain: number;
}

function getResourceRank(ball: CaptureBallCandidate): number {
  if (ball.resourceRank !== undefined) return ball.resourceRank;

  const parsedId = Number(ball.id);
  return Number.isFinite(parsedId) ? parsedId : Math.max(ball.multiplier, 0);
}

function evaluateBalls(snapshot: CaptureSnapshot, balls: CaptureBallCandidate[]): EvaluatedBall[] {
  return balls
    .filter(ball => ball.count > 0)
    .map(ball => ({
      ball,
      probability: getCaptureProbability(snapshot, ball),
      resourceRank: getResourceRank(ball),
    }));
}

function getEquivalenceMargin(bestProbability: number): number {
  if (bestProbability >= 0.95) return 0.03;
  if (bestProbability >= 0.8) return 0.02;
  if (bestProbability >= 0.6) return 0.01;
  return 0.005;
}

function choosePracticalBall(evaluated: EvaluatedBall[], teamFitScore?: number): BallSelection | undefined {
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

function getThrowDecisionStrength(selection: BallSelection): DecisionStrength {
  const { chosen, highestProbability, equivalent } = selection;
  if (equivalent.length > 1 && chosen.ball.id !== highestProbability.ball.id) return "equivalent";
  if (chosen.probability >= 0.9) return "strong";
  if (chosen.probability >= 0.7) return "moderate";
  if (chosen.probability >= 0.45) return "slight";
  return "situational";
}

function buildThrowDecision(
  snapshot: CaptureSnapshot,
  selection: BallSelection,
): AdvisorRecommendation {
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

  if (snapshot.activeHpRatio !== undefined && snapshot.activeHpRatio <= 0.35) {
    reasons.push("Your active Pokémon is low on HP, so spending another setup turn is risky.");
  }

  if (chosen.ball.count <= 2) {
    reasons.push(`Only ${chosen.ball.count} ${chosen.ball.name}${chosen.ball.count === 1 ? "" : "s"} remaining.`);
  }

  return {
    id: `capture:${snapshot.targetId ?? snapshot.speciesName}:decision`,
    label: `THROW ${chosen.ball.name.toUpperCase()} NOW`,
    score: chosen.probability * 100,
    probability: chosen.probability,
    isDecision: true,
    decisionStrength: getThrowDecisionStrength(selection),
    reason: reasons,
    metadata: {
      action: "throw",
      ballId: chosen.ball.id,
      targetId: snapshot.targetId ?? null,
      targetName: snapshot.speciesName,
    },
  };
}

function getExtraTurnRiskPenalty(activeHpRatio?: number): number {
  if (activeHpRatio === undefined) return 0.02;
  if (activeHpRatio <= 0.3) return 0.2;
  if (activeHpRatio <= 0.45) return 0.08;
  if (activeHpRatio <= 0.65) return 0.04;
  return 0.015;
}

function getMinimumPreparationImprovement(currentProbability: number): number {
  if (currentProbability < 0.4) return 0.08;
  if (currentProbability < 0.7) return 0.06;
  if (currentProbability < 0.85) return 0.08;
  return 0.12;
}

function evaluatePreparation(
  snapshot: CaptureSnapshot,
  currentSelection: BallSelection,
  option: CapturePreparationOption,
): EvaluatedPreparation | undefined {
  const projectedSnapshot: CaptureSnapshot = {
    ...snapshot,
    hp: option.projectedHp ?? snapshot.hp,
    statusMultiplier: option.statusMultiplier ?? snapshot.statusMultiplier,
    balls: option.projectedBalls,
    preparations: undefined,
  };
  const projectedSelection = choosePracticalBall(
    evaluateBalls(projectedSnapshot, option.projectedBalls),
    snapshot.teamFitScore,
  );
  if (!projectedSelection) return;

  const successProbability = clamp01(option.successProbability ?? 1);
  const currentProbability = currentSelection.chosen.probability;
  const projectedProbability = projectedSelection.chosen.probability;
  const expectedProbability = currentProbability
    + successProbability * Math.max(projectedProbability - currentProbability, 0);
  const rawImprovement = expectedProbability - currentProbability;
  const resourceSavings = Math.max(
    currentSelection.chosen.resourceRank - projectedSelection.chosen.resourceRank,
    0,
  ) * 0.02;
  const utilityGain = rawImprovement + resourceSavings - getExtraTurnRiskPenalty(snapshot.activeHpRatio);

  return {
    option,
    selection: projectedSelection,
    expectedProbability,
    rawImprovement,
    utilityGain,
  };
}

function getPreparationDecisionStrength(preparation: EvaluatedPreparation): DecisionStrength {
  if (preparation.utilityGain >= 0.18) return "strong";
  if (preparation.utilityGain >= 0.1) return "moderate";
  if (preparation.utilityGain >= 0.04) return "slight";
  return "situational";
}

function choosePreparation(
  snapshot: CaptureSnapshot,
  currentSelection: BallSelection,
): EvaluatedPreparation | undefined {
  if (!snapshot.preparations?.length) return;
  if (currentSelection.chosen.probability >= 0.9) return;
  if (snapshot.activeHpRatio !== undefined && snapshot.activeHpRatio <= 0.3) return;

  const minimumImprovement = getMinimumPreparationImprovement(currentSelection.chosen.probability);
  return snapshot.preparations
    .map(option => evaluatePreparation(snapshot, currentSelection, option))
    .filter((entry): entry is EvaluatedPreparation => !!entry)
    .filter(entry => entry.rawImprovement >= minimumImprovement && entry.utilityGain >= 0.025)
    .sort((a, b) =>
      b.utilityGain - a.utilityGain
      || b.expectedProbability - a.expectedProbability
      || a.selection.chosen.resourceRank - b.selection.chosen.resourceRank,
    )[0];
}

function buildPreparationDecision(
  snapshot: CaptureSnapshot,
  currentSelection: BallSelection,
  preparation: EvaluatedPreparation,
): AdvisorRecommendation {
  const { option, selection } = preparation;
  const currentPct = currentSelection.chosen.probability * 100;
  const projectedPct = selection.chosen.probability * 100;
  const reasons = [
    `Current practical catch chance: ${currentPct.toFixed(1)}%.`,
    `${option.moveName} can improve it to about ${projectedPct.toFixed(1)}% with ${selection.chosen.ball.name}.`,
  ];

  if (option.kind === "weaken" && option.estimatedDamageRatio !== undefined) {
    reasons.push(`Estimated damage is ${(option.estimatedDamageRatio * 100).toFixed(0)}% of the target's current HP.`);
  }
  if (option.kind === "status") {
    const successProbability = clamp01(option.successProbability ?? 1);
    reasons.push(
      `${option.statusName ?? "Status"} setup is about ${(successProbability * 100).toFixed(0)}% reliable before immunity/field edge cases.`,
    );
  }
  if (selection.chosen.resourceRank < currentSelection.chosen.resourceRank) {
    reasons.push(`Preparation also lets you conserve a stronger ball by switching to ${selection.chosen.ball.name}.`);
  }
  if (option.warning) reasons.push(option.warning);
  reasons.push(`Then throw ${selection.chosen.ball.name}.`);

  const actionLabel = option.kind === "weaken"
    ? `WEAKEN WITH ${option.moveName.toUpperCase()}`
    : `APPLY ${option.statusName?.toUpperCase() ?? "STATUS"} WITH ${option.moveName.toUpperCase()}`;

  return {
    id: `capture:${snapshot.targetId ?? snapshot.speciesName}:decision`,
    label: actionLabel,
    score: preparation.utilityGain * 100,
    probability: preparation.expectedProbability,
    isDecision: true,
    decisionStrength: getPreparationDecisionStrength(preparation),
    reason: reasons,
    metadata: {
      action: option.kind,
      moveIndex: option.moveIndex,
      moveName: option.moveName,
      nextBallId: selection.chosen.ball.id,
      targetId: snapshot.targetId ?? null,
      targetName: snapshot.speciesName,
    },
  };
}

function buildSkipDecision(snapshot: CaptureSnapshot): AdvisorRecommendation | undefined {
  if (snapshot.teamFitScore === undefined || snapshot.teamFitScore >= 25 || snapshot.isShiny) return;

  return {
    id: `capture:${snapshot.targetId ?? snapshot.speciesName}:decision`,
    label: `SKIP ${snapshot.speciesName.toUpperCase()}`,
    score: 100 - snapshot.teamFitScore,
    isDecision: true,
    decisionStrength: snapshot.teamFitScore < 12 ? "strong" : "moderate",
    reason: [
      `Catch value is only ${snapshot.teamFitScore.toFixed(0)}/100 for the current team.`,
      "Save balls and battle tempo for a more useful target.",
    ],
    metadata: {
      action: "skip",
      targetId: snapshot.targetId ?? null,
      targetName: snapshot.speciesName,
    },
  };
}

export function analyzeCapture(snapshot: CaptureSnapshot): AdvisorRecommendation[] {
  const evaluated = evaluateBalls(snapshot, snapshot.balls);
  const selection = choosePracticalBall(evaluated, snapshot.teamFitScore);
  const skipDecision = buildSkipDecision(snapshot);
  const preparation = selection ? choosePreparation(snapshot, selection) : undefined;
  const decision = skipDecision
    ?? (selection && preparation ? buildPreparationDecision(snapshot, selection, preparation) : undefined)
    ?? (selection ? buildThrowDecision(snapshot, selection) : undefined);

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
