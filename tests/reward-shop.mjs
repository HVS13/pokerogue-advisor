import assert from "node:assert/strict";
import { analyzeRewardChoices, analyzeShopChoices, analyzeRewardShop } from "../dist/core/choices.js";
import { analyzeSnapshot } from "../dist/core/advisor.js";

let analysis = analyzeRewardChoices([
  { id: "multi-lens", name: "Multi Lens", score: 24000, reason: "high-priority Rogue reward", target: "Garchomp" },
  { id: "exp", name: "EXP Charm", score: 18000, reason: "useful progression reward" },
]);
assert.equal(analysis.decision.label, "PICK MULTI LENS");
assert.equal(analysis.decision.decisionStrength, "strong");
assert.match(analysis.decision.reason.join(" "), /Best target: Garchomp/i);

analysis = analyzeRewardChoices([
  { id: "a", name: "Choice A", score: 10000 },
  { id: "b", name: "Choice B", score: 9950 },
]);
assert.equal(analysis.decision.decisionStrength, "equivalent");
assert.match(analysis.decision.reason.join(" "), /effectively tied/i);

analysis = analyzeRewardChoices([]);
assert.equal(analysis.decision.label, "SKIP REWARD");
assert.equal(analysis.decision.metadata.action, "skip");

let shop = analyzeShopChoices([
  {
    id: "revive",
    name: "Revive",
    score: 90,
    cost: 1200,
    target: "Ace",
    emergency: true,
    reserveCost: 2500,
    moneyAfterPurchase: 3800,
    reason: "revives a fainted Pokemon",
  },
  {
    id: "potion",
    name: "Potion",
    score: 150,
    cost: 200,
    target: "Lead",
    emergency: false,
    reserveCost: 2500,
    moneyAfterPurchase: 4800,
    reason: "heals meaningful HP loss",
  },
], 5000, 2500);
assert.equal(shop.decision.label, "BUY REVIVE", "emergency recovery must outrank a higher raw non-emergency score");
assert.equal(shop.decision.decisionStrength, "strong");
assert.match(shop.decision.reason.join(" "), /Emergency recovery need/i);
assert.match(shop.decision.reason.join(" "), /Reassess after the purchase/i);

shop = analyzeShopChoices([], 2000, 2500);
assert.equal(shop.decision.label, "SAVE MONEY");
assert.match(shop.decision.reason.join(" "), /Current money: 2000/);
assert.match(shop.decision.reason.join(" "), /Recommended reserve: 2500/);

const combined = analyzeRewardShop(
  [{ id: "leftovers", name: "Leftovers", score: 25000, target: "Tank" }],
  [{ id: "hyper", name: "Hyper Potion", score: 70, cost: 800, target: "Tank", moneyAfterPurchase: 4200, reserveCost: 1500 }],
  5000,
  1500,
);
assert.equal(combined[0].label, "PICK LEFTOVERS");
assert.equal(combined[1].label, "BUY HYPER POTION");
assert.equal(combined[0].isDecision, true);
assert.equal(combined[1].isDecision, true);

const snapshotRecs = analyzeSnapshot({
  version: 1,
  context: "reward-shop",
  generatedAt: 1,
  rewards: [{ id: "lens", name: "Multi Lens", score: 20000 }],
  shop: [],
  shopMoney: 4000,
  shopReserve: 1200,
});
assert.equal(snapshotRecs[0].label, "PICK MULTI LENS");
assert.equal(snapshotRecs[1].label, "SAVE MONEY");

console.log("PASS reward/shop decision tests");
