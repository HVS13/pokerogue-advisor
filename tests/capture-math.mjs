import assert from "node:assert/strict";
import { getCaptureProbability } from "../dist/core/capture.js";

const snapshot = {
  speciesName: "FormulaTest",
  hp: 50,
  maxHp: 100,
  catchRate: 45,
  statusMultiplier: 1,
  shinyMultiplier: 1,
  criticalCaptureProbability: 0.1,
  balls: [],
};

const ultraBall = {
  id: "2",
  name: "Ultra Ball",
  multiplier: 2,
  count: 1,
};

const probability = getCaptureProbability(snapshot, ultraBall);
assert(Math.abs(probability - 0.47505661454658826) < 1e-12, `unexpected capture probability: ${probability}`);

const masterBall = {
  id: "4",
  name: "Master Ball",
  multiplier: -1,
  count: 1,
};
assert.equal(getCaptureProbability(snapshot, masterBall), 1);

console.log("PASS capture shake/critical formula regression");
