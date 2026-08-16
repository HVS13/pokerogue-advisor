import assert from "node:assert/strict";
import { AcceptanceRecorder } from "../dist/debug/acceptance-recorder.js";

const recorder = new AcceptanceRecorder(2);
const recommendation = [{ id: "decision", label: "DO THING", score: 1, reason: [], isDecision: true }];

const captureA = {
  version: 1,
  context: "capture",
  generatedAt: 1,
  captureTargets: [{ speciesName: "A", hp: 10, maxHp: 20, catchRate: 45, statusMultiplier: 1, shinyMultiplier: 1, balls: [] }],
};
const captureASameContent = { ...captureA, generatedAt: 999 };
const battleB = {
  version: 1,
  context: "battle",
  generatedAt: 2,
  battle: { actorName: "B", opponentNames: ["C"], moves: [] },
};
const rewardC = {
  version: 1,
  context: "reward-shop",
  generatedAt: 3,
  rewards: [],
  shop: [],
};
const idle = { version: 1, context: "idle", generatedAt: 4 };

assert.equal(recorder.record(captureA, recommendation, 10), true);
assert.equal(recorder.record(captureASameContent, recommendation, 11), false, "generatedAt-only changes must dedupe");
assert.equal(recorder.record(idle, recommendation, 12), false, "idle state must not be recorded");
assert.equal(recorder.record(battleB, recommendation, 13), true);
assert.equal(recorder.record(rewardC, recommendation, 14), true);
assert.equal(recorder.size(), 2, "recorder must remain bounded");

const session = recorder.exportSession(20);
assert.equal(session.format, "pokerogue-advisor-session");
assert.equal(session.version, 1);
assert.equal(session.exportedAt, 20);
assert.deepEqual(session.entries.map(entry => entry.sequence), [2, 3]);
assert.deepEqual(session.entries.map(entry => entry.snapshot.context), ["battle", "reward-shop"]);

session.entries[0].snapshot.context = "idle";
const secondExport = recorder.exportSession(21);
assert.equal(secondExport.entries[0].snapshot.context, "battle", "export must not expose recorder-owned objects");

console.log("PASS bounded, deduplicated acceptance recorder test");
