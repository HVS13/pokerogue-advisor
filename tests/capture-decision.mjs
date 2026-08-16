import assert from "node:assert/strict";
import { analyzeCapture, getCaptureProbability } from "../dist/core/capture.js";
import { analyzeSnapshot } from "../dist/core/advisor.js";

const base = {
  targetId: 101,
  speciesName: "Garchomp",
  hp: 30,
  maxHp: 100,
  catchRate: 45,
  statusMultiplier: 1,
  shinyMultiplier: 1,
};

const exactBall = { id: "2", name: "Ultra Ball", multiplier: 2, count: 5, probability: 0.858, resourceRank: 2 };
assert.equal(getCaptureProbability({ ...base, balls: [exactBall] }, exactBall), 0.858);

let recs = analyzeCapture({ ...base, balls: [
  { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.858, resourceRank: 2 },
  { id: "3", name: "Rogue Ball", multiplier: 3, count: 10, probability: 0.86, resourceRank: 3 },
] });
assert.equal(recs[0].isDecision, true);
assert.equal(recs[0].label, "THROW ULTRA BALL NOW");
assert.equal(recs[0].decisionStrength, "equivalent");
assert.match(recs[0].reason.join(" "), /preserve the rarer ball/i);

recs = analyzeCapture({ ...base, balls: [
  { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.55, resourceRank: 2 },
  { id: "3", name: "Rogue Ball", multiplier: 3, count: 10, probability: 0.72, resourceRank: 3 },
] });
assert.equal(recs[0].label, "THROW ROGUE BALL NOW");

recs = analyzeCapture({ ...base, balls: [
  { id: "2", name: "Ultra Ball", multiplier: 2, count: 8, probability: 0.84, resourceRank: 2 },
  { id: "3", name: "Rogue Ball", multiplier: 3, count: 1, probability: 0.85, resourceRank: 3 },
] });
assert.equal(recs[0].label, "THROW ULTRA BALL NOW");

recs = analyzeCapture({ ...base, balls: [
  { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.858, resourceRank: 2 },
  { id: "4", name: "Master Ball", multiplier: -1, count: 2, probability: 1, resourceRank: 4 },
] });
assert.equal(recs[0].label, "THROW ULTRA BALL NOW");
assert.match(recs[0].reason.join(" "), /preserve master-tier/i);

recs = analyzeCapture({ ...base, teamFitScore: 95, balls: [
  { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.35, resourceRank: 2 },
  { id: "4", name: "Master Ball", multiplier: -1, count: 2, probability: 1, resourceRank: 4 },
] });
assert.equal(recs[0].label, "THROW MASTER BALL NOW");

recs = analyzeCapture({
  ...base,
  activeHpRatio: 0.9,
  balls: [{ id: "2", name: "Ultra Ball", multiplier: 2, count: 8, probability: 0.3, resourceRank: 2 }],
  preparations: [{
    kind: "weaken",
    moveIndex: 1,
    moveName: "False Swipe",
    successProbability: 1,
    estimatedDamageRatio: 0.45,
    projectedHp: 17,
    projectedBalls: [{ id: "2", name: "Ultra Ball", multiplier: 2, count: 8, probability: 0.68, resourceRank: 2 }],
  }],
});
assert.equal(recs[0].label, "WEAKEN WITH FALSE SWIPE");
assert.match(recs[0].reason.join(" "), /30\.0%.*68\.0%/i);
assert.equal(recs[0].metadata.action, "weaken");

recs = analyzeCapture({
  ...base,
  activeHpRatio: 0.2,
  balls: [{ id: "2", name: "Ultra Ball", multiplier: 2, count: 8, probability: 0.3, resourceRank: 2 }],
  preparations: [{
    kind: "weaken",
    moveIndex: 1,
    moveName: "False Swipe",
    successProbability: 1,
    estimatedDamageRatio: 0.45,
    projectedHp: 17,
    projectedBalls: [{ id: "2", name: "Ultra Ball", multiplier: 2, count: 8, probability: 0.68, resourceRank: 2 }],
  }],
});
assert.equal(recs[0].label, "THROW ULTRA BALL NOW");
assert.match(recs[0].reason.join(" "), /low on HP/i);

recs = analyzeCapture({
  ...base,
  activeHpRatio: 0.85,
  balls: [{ id: "1", name: "Great Ball", multiplier: 1.5, count: 9, probability: 0.24, resourceRank: 1 }],
  preparations: [{
    kind: "status",
    moveIndex: 2,
    moveName: "Spore",
    statusName: "Sleep",
    statusMultiplier: 2.5,
    successProbability: 1,
    projectedBalls: [{ id: "1", name: "Great Ball", multiplier: 1.5, count: 9, probability: 0.58, resourceRank: 1 }],
  }],
});
assert.equal(recs[0].label, "APPLY SLEEP WITH SPORE");
assert.equal(recs[0].metadata.action, "status");

recs = analyzeCapture({
  ...base,
  teamFitScore: 10,
  balls: [{ id: "0", name: "Poke Ball", multiplier: 1, count: 20, probability: 0.7, resourceRank: 0 }],
});
assert.equal(recs[0].label, "SKIP GARCHOMP");
assert.equal(recs[0].metadata.action, "skip");

recs = analyzeCapture({
  ...base,
  teamFitScore: 10,
  isShiny: true,
  balls: [{ id: "0", name: "Poke Ball", multiplier: 1, count: 20, probability: 0.7, resourceRank: 0 }],
});
assert.equal(recs[0].label, "THROW POKE BALL NOW");

const multi = analyzeSnapshot({
  version: 1,
  context: "capture",
  generatedAt: Date.now(),
  captureTargets: [
    { ...base, targetId: 1, speciesName: "Pidgey", balls: [{ id: "0", name: "Poke Ball", multiplier: 1, count: 5, probability: 0.7, resourceRank: 0 }] },
    { ...base, targetId: 2, speciesName: "Rattata", balls: [{ id: "0", name: "Poke Ball", multiplier: 1, count: 5, probability: 0.6, resourceRank: 0 }] },
  ],
});
assert(multi.some(rec => rec.isDecision && rec.label.startsWith("Pidgey · THROW")));
assert(multi.some(rec => rec.isDecision && rec.label.startsWith("Rattata · THROW")));
console.log("PASS capture decision tests");
