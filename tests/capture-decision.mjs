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
assert.equal(recs[0].label, "USE ULTRA BALL NOW");
assert.equal(recs[0].decisionStrength, "equivalent");
assert.match(recs[0].reason.join(" "), /preserve the rarer ball/i);

recs = analyzeCapture({ ...base, balls: [
  { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.55, resourceRank: 2 },
  { id: "3", name: "Rogue Ball", multiplier: 3, count: 10, probability: 0.72, resourceRank: 3 },
] });
assert.equal(recs[0].label, "USE ROGUE BALL NOW");

recs = analyzeCapture({ ...base, balls: [
  { id: "2", name: "Ultra Ball", multiplier: 2, count: 8, probability: 0.84, resourceRank: 2 },
  { id: "3", name: "Rogue Ball", multiplier: 3, count: 1, probability: 0.85, resourceRank: 3 },
] });
assert.equal(recs[0].label, "USE ULTRA BALL NOW");

recs = analyzeCapture({ ...base, balls: [
  { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.858, resourceRank: 2 },
  { id: "4", name: "Master Ball", multiplier: -1, count: 2, probability: 1, resourceRank: 4 },
] });
assert.equal(recs[0].label, "USE ULTRA BALL NOW");
assert.match(recs[0].reason.join(" "), /preserve master-tier/i);

recs = analyzeCapture({ ...base, teamFitScore: 95, balls: [
  { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.35, resourceRank: 2 },
  { id: "4", name: "Master Ball", multiplier: -1, count: 2, probability: 1, resourceRank: 4 },
] });
assert.equal(recs[0].label, "USE MASTER BALL NOW");

const multi = analyzeSnapshot({
  version: 1,
  context: "capture",
  generatedAt: Date.now(),
  captureTargets: [
    { ...base, targetId: 1, speciesName: "Pidgey", balls: [{ id: "0", name: "Poke Ball", multiplier: 1, count: 5, probability: 0.7, resourceRank: 0 }] },
    { ...base, targetId: 2, speciesName: "Rattata", balls: [{ id: "0", name: "Poke Ball", multiplier: 1, count: 5, probability: 0.6, resourceRank: 0 }] },
  ],
});
assert(multi.some(rec => rec.isDecision && rec.label.startsWith("Pidgey · USE")));
assert(multi.some(rec => rec.isDecision && rec.label.startsWith("Rattata · USE")));
console.log("PASS capture decision tests");
