import type { AdvisorRecommendation, ChoiceCandidate, DecisionStrength } from "./types.js";

interface ChoiceAnalysis {
  decision: AdvisorRecommendation;
  evidence: AdvisorRecommendation[];
}

function sortChoices(choices: ChoiceCandidate[]): ChoiceCandidate[] {
  return [...choices].sort((a, b) =>
    Number(!!b.emergency) - Number(!!a.emergency)
    || b.score - a.score,
  );
}

function getChoiceStrength(best: ChoiceCandidate, second?: ChoiceCandidate): DecisionStrength {
  if (!second) return "strong";
  if (best.emergency && !second.emergency) return "strong";

  const gap = best.score - second.score;
  const scale = Math.max(Math.abs(best.score), 100);
  const relativeGap = gap / scale;
  if (gap <= 1 || relativeGap <= 0.02) return "equivalent";
  if (relativeGap <= 0.08) return "slight";
  if (relativeGap <= 0.22) return "moderate";
  return "strong";
}

function getChoiceReasons(choice: ChoiceCandidate, includeCost = true): string[] {
  return [
    ...(choice.reason ? [choice.reason] : []),
    ...(choice.target ? [`Best target: ${choice.target}`] : []),
    ...(choice.emergency ? ["Emergency recovery need takes priority."] : []),
    ...(includeCost && choice.cost !== undefined ? [`Cost: ${choice.cost}`] : []),
    ...(choice.moneyAfterPurchase !== undefined ? [`Money after purchase: ${choice.moneyAfterPurchase}`] : []),
    ...(choice.reserveCost !== undefined ? [`Recommended reserve: ${choice.reserveCost}`] : []),
  ];
}

function toEvidence(prefix: "reward" | "shop", sorted: ChoiceCandidate[]): AdvisorRecommendation[] {
  return sorted.map((choice, index) => ({
    id: `${prefix}:${choice.id}`,
    label: choice.name,
    score: choice.score,
    rank: index + 1,
    reason: getChoiceReasons(choice),
    metadata: {
      cost: choice.cost ?? null,
      target: choice.target ?? null,
      emergency: !!choice.emergency,
      reserveCost: choice.reserveCost ?? null,
      moneyAfterPurchase: choice.moneyAfterPurchase ?? null,
    },
  }));
}

export function analyzeRewardChoices(choices: ChoiceCandidate[]): ChoiceAnalysis {
  const sorted = sortChoices(choices);
  const best = sorted[0];
  const second = sorted[1];

  if (!best) {
    return {
      decision: {
        id: "reward:decision:skip",
        label: "SKIP REWARD",
        score: 0,
        isDecision: true,
        decisionStrength: "situational",
        reason: ["No currently useful reward was identified by the game scoring logic."],
        metadata: { action: "skip" },
      },
      evidence: [],
    };
  }

  const strength = getChoiceStrength(best, second);
  const reasons = getChoiceReasons(best, false);
  if (second && strength === "equivalent") {
    reasons.push(`${second.name} is effectively tied; either reward is reasonable.`);
  } else if (second && strength === "slight") {
    reasons.push(`${second.name} is a reasonable alternative with a small score gap.`);
  }

  return {
    decision: {
      id: `reward:decision:${best.id}`,
      label: `PICK ${best.name.toUpperCase()}`,
      score: best.score,
      isDecision: true,
      decisionStrength: strength,
      reason: reasons,
      metadata: { action: "pick", choiceId: best.id, target: best.target ?? null },
    },
    evidence: toEvidence("reward", sorted),
  };
}

export function analyzeShopChoices(
  choices: ChoiceCandidate[],
  money?: number,
  reserveCost?: number,
): ChoiceAnalysis {
  const sorted = sortChoices(choices);
  const best = sorted[0];
  const second = sorted[1];

  if (!best) {
    const reasons = ["No purchase is worth breaking the current recovery reserve."];
    if (money !== undefined) reasons.push(`Current money: ${money}.`);
    if (reserveCost !== undefined) reasons.push(`Recommended reserve: ${reserveCost}.`);
    return {
      decision: {
        id: "shop:decision:save",
        label: "SAVE MONEY",
        score: 0,
        isDecision: true,
        decisionStrength: "strong",
        reason: reasons,
        metadata: { action: "save", money: money ?? null, reserveCost: reserveCost ?? null },
      },
      evidence: [],
    };
  }

  const strength = getChoiceStrength(best, second);
  const reasons = getChoiceReasons(best);
  if (second && strength === "equivalent") {
    reasons.push(`${second.name} is similarly useful; buy only one before reassessing.`);
  } else if (second && strength === "slight") {
    reasons.push(`${second.name} is a reasonable alternative.`);
  }
  reasons.push("Reassess after the purchase because HP, PP, money, and reserve state will change.");

  return {
    decision: {
      id: `shop:decision:${best.id}`,
      label: `BUY ${best.name.toUpperCase()}`,
      score: best.score,
      isDecision: true,
      decisionStrength: strength,
      reason: reasons,
      metadata: {
        action: "buy",
        choiceId: best.id,
        cost: best.cost ?? null,
        target: best.target ?? null,
      },
    },
    evidence: toEvidence("shop", sorted),
  };
}

/** Backward-compatible single-group helper. */
export function rankChoices(prefix: "reward" | "shop", choices: ChoiceCandidate[]): AdvisorRecommendation[] {
  const analysis = prefix === "reward"
    ? analyzeRewardChoices(choices)
    : analyzeShopChoices(choices);
  return [analysis.decision, ...analysis.evidence];
}

export function analyzeRewardShop(
  rewards: ChoiceCandidate[],
  shop: ChoiceCandidate[],
  money?: number,
  reserveCost?: number,
): AdvisorRecommendation[] {
  const reward = analyzeRewardChoices(rewards);
  const shopAnalysis = analyzeShopChoices(shop, money, reserveCost);
  return [
    reward.decision,
    shopAnalysis.decision,
    ...reward.evidence,
    ...shopAnalysis.evidence,
  ];
}
