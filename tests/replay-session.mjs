import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { analyzeSnapshot } from "../dist/core/advisor.js";

const dir = await mkdtemp(join(tmpdir(), "pokerogue-advisor-replay-"));
const file = join(dir, "session.json");
const snapshot = {
  version: 1,
  context: "battle",
  generatedAt: 123,
  battle: {
    actorName: "Raichu",
    opponentNames: ["Gyarados"],
    moves: [
      { id: "85:1", name: "Thunderbolt", plannerScore: 130, target: "Gyarados", reasons: ["Strong offensive value."] },
      { id: "58:1", name: "Ice Beam", plannerScore: 90, target: "Gyarados" },
    ],
  },
};
const recommendations = analyzeSnapshot(snapshot);
const session = {
  format: "pokerogue-advisor-session",
  version: 1,
  exportedAt: 456,
  entries: [{ sequence: 1, recordedAt: 124, snapshot, recommendations }],
};

try {
  await writeFile(file, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  let result = spawnSync(process.execPath, ["scripts/replay-session.mjs", file], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS: 1 recorded states replay exactly/);

  session.entries[0].recommendations[0].label = "WRONG DECISION";
  await writeFile(file, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  result = spawnSync(process.execPath, ["scripts/replay-session.mjs", file], { encoding: "utf8" });
  assert.equal(result.status, 1, "tampered recommendation must fail replay verification");
  assert.match(result.stderr, /Mismatch #1/);
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log("PASS acceptance session replay verifier test");
