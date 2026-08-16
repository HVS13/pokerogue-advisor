import assert from "node:assert/strict";
import { assessCatchValue } from "../dist/core/catch-value.js";
import { analyzeSnapshot } from "../dist/core/advisor.js";

const ball = { id: "2", name: "Ultra Ball", multiplier: 2, count: 8, probability: 0.75, resourceRank: 2 };
const base = {
  targetId: 88,
  targetSpeciesId: 999,
  speciesName: "Testmon",
  hp: 50,
  maxHp: 100,
  catchRate: 120,
  statusMultiplier: 1,
  shinyMultiplier: 1,
  targetBaseStatTotal: 300,
  targetTypes: [3],
  balls: [ball],
};

let assessment = assessCatchValue({
  ...base,
  partyCapacity: 6,
  party: [
    { speciesId: 1, name: "Starter", baseStatTotal: 500, types: [1, 2] },
    { speciesId: 2, name: "Buddy", baseStatTotal: 480, types: [2] },
  ],
});
assert(assessment);
assert(assessment.score >= 35, "open party slots must not auto-skip low-current-BST targets");
assert.match(assessment.reasons.join(" "), /open party slot/i);

assessment = assessCatchValue({
  ...base,
  isShiny: true,
  partyCapacity: 3,
  party: [
    { speciesId: 1, name: "A", baseStatTotal: 600, types: [1] },
    { speciesId: 2, name: "B", baseStatTotal: 600, types: [2] },
    { speciesId: 3, name: "C", baseStatTotal: 600, types: [3] },
  ],
});
assert.equal(assessment?.score, 100);

const fullParty = [
  { speciesId: 100, name: "Weakest", baseStatTotal: 420, types: [1] },
  { speciesId: 101, name: "Mid", baseStatTotal: 500, types: [2] },
  { speciesId: 102, name: "Ace", baseStatTotal: 580, types: [4] },
];
assessment = assessCatchValue({
  ...base,
  targetSpeciesId: 101,
  targetBaseStatTotal: 300,
  targetTypes: [2],
  partyCapacity: 3,
  party: fullParty,
});
assert(assessment && assessment.score < 25, "clearly inferior duplicate can be auto-skipped");

const skipRecs = analyzeSnapshot({
  version: 1,
  context: "capture",
  generatedAt: 1,
  capture: {
    ...base,
    targetSpeciesId: 101,
    targetBaseStatTotal: 300,
    targetTypes: [2],
    partyCapacity: 3,
    party: fullParty,
  },
});
assert.equal(skipRecs[0].label, "SKIP TESTMON");
assert.match(skipRecs.find(rec => rec.label === "Catch value: Testmon")?.reason.join(" ") ?? "", /same species/i);

assessment = assessCatchValue({
  ...base,
  targetSpeciesId: 200,
  targetBaseStatTotal: 540,
  targetTypes: [7],
  catchRate: 45,
  partyCapacity: 3,
  party: fullParty,
});
assert(assessment && assessment.score >= 60);
assert.equal(assessment.replacementName, "Weakest");
assert.match(assessment.reasons.join(" "), /unrepresented type/i);

assessment = assessCatchValue({
  ...base,
  targetSpeciesId: 201,
  targetBaseStatTotal: 250,
  targetTypes: [8],
  partyCapacity: 3,
  party: fullParty,
});
assert(assessment && assessment.score >= 30, "unique unevolved-looking targets stay above auto-skip floor");

assessment = assessCatchValue({ ...base, teamFitScore: 82, replacementName: "Oldmon" });
assert.equal(assessment?.score, 82);
assert.equal(assessment?.replacementName, "Oldmon");

console.log("PASS catch value tests");
