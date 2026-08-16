import assert from "node:assert/strict";
import { analyzeBattleMoves } from "../dist/core/battle.js";

let recs = analyzeBattleMoves([
  { id: "85:1", name: "Thunderbolt", plannerScore: 100, target: "Gyarados", reasons: ["Strong offensive value."] },
  { id: "58:1", name: "Ice Beam", plannerScore: 99, target: "Gyarados" },
]);
assert.equal(recs[0].isDecision, true);
assert.equal(recs[0].label, "USE THUNDERBOLT → GYARADOS");
assert.equal(recs[0].decisionStrength, "equivalent");
assert.equal(recs[0].confidence, 0.52);
assert.match(recs[0].reason.join(" "), /Ice Beam.*effectively tied/i);
assert.equal(recs[1].label, "Thunderbolt → Gyarados");
assert.equal(recs[2].label, "Ice Beam → Gyarados");

recs = analyzeBattleMoves([
  { id: "89:1", name: "Earthquake", plannerScore: 140, target: "Gholdengo", reasons: ["Strong offensive value.", "Reduces an immediate threat."] },
  { id: "337:1", name: "Dragon Claw", plannerScore: 92, target: "Gholdengo" },
  { id: "14:0", name: "Swords Dance", plannerScore: 70 },
]);
assert.equal(recs[0].label, "USE EARTHQUAKE → GHOLDENGO");
assert.equal(recs[0].decisionStrength, "strong");
assert.equal(recs[0].confidence, 0.88);
assert.match(recs[0].reason.join(" "), /140\.0 vs 92\.0 next-best/);

recs = analyzeBattleMoves([
  { id: "1", name: "Move A", plannerScore: 80 },
  { id: "2", name: "Move B", plannerScore: 75 },
]);
assert.equal(recs[0].decisionStrength, "slight");
assert.match(recs[0].reason.join(" "), /reasonable alternative/i);

recs = analyzeBattleMoves([
  { id: "1", name: "Move A", plannerScore: 80 },
  { id: "2", name: "Move B", plannerScore: 65 },
]);
assert.equal(recs[0].decisionStrength, "moderate");

recs = analyzeBattleMoves([
  { id: "1", name: "Protect", plannerScore: 42, reasons: ["Defensive/protect value."] },
]);
assert.equal(recs[0].decisionStrength, "strong");
assert.match(recs[0].reason.join(" "), /Defensive\/protect value/i);

assert.deepEqual(analyzeBattleMoves([]), []);
console.log("PASS battle decision tests");
