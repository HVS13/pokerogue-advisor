#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyzeSnapshot } from "../dist/core/advisor.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/replay-session.mjs <pokerogue-advisor-session.json>");
  process.exit(2);
}

let session;
try {
  session = JSON.parse(await readFile(resolve(file), "utf8"));
} catch (error) {
  console.error(`Could not read session: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

if (session?.format !== "pokerogue-advisor-session" || session?.version !== 1 || !Array.isArray(session.entries)) {
  console.error("Unsupported or invalid PokeRogue Advisor session file.");
  process.exit(2);
}

let mismatches = 0;
for (const entry of session.entries) {
  const replayed = analyzeSnapshot(entry.snapshot);
  if (JSON.stringify(replayed) === JSON.stringify(entry.recommendations)) continue;

  mismatches += 1;
  const recordedDecision = entry.recommendations?.find(rec => rec.isDecision)?.label ?? "(none)";
  const replayedDecision = replayed.find(rec => rec.isDecision)?.label ?? "(none)";
  console.error(`Mismatch #${entry.sequence ?? "?"} [${entry.snapshot?.context ?? "unknown"}]`);
  console.error(`  recorded: ${recordedDecision}`);
  console.error(`  replayed: ${replayedDecision}`);
}

if (mismatches > 0) {
  console.error(`FAIL: ${mismatches}/${session.entries.length} recorded states changed.`);
  process.exit(1);
}

console.log(`PASS: ${session.entries.length} recorded states replay exactly.`);
