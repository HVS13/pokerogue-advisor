import type { AdvisorRecommendation, ChoiceCandidate } from "./types.js";

export function rankChoices(prefix: "reward" | "shop", choices: ChoiceCandidate[]): AdvisorRecommendation[] {
  return [...choices]
    .sort((a, b) => b.score - a.score)
    .map((choice, index) => ({
      id: `${prefix}:${choice.id}`,
      label: choice.name,
      score: choice.score,
      rank: index + 1,
      reason: [
        ...(choice.reason ? [choice.reason] : []),
        ...(choice.target ? [`Best target: ${choice.target}`] : []),
        ...(choice.cost !== undefined ? [`Cost: ${choice.cost}`] : []),
      ],
      metadata: { cost: choice.cost ?? null, target: choice.target ?? null },
    }));
}
