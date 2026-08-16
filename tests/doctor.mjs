import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { diagnose2p } from "../integrations/solvolrund-2p/doctor.mjs";
import { diagnoseOfficial } from "../integrations/pagefaultgames-official/doctor.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "pokerogue-advisor-doctor-"));
try {
  const twoPlayerRoot = path.join(root, "two-player");
  const twoPlayerSrc = path.join(twoPlayerRoot, "pokerogue-beta", "src");
  await mkdir(path.join(twoPlayerSrc, "utils"), { recursive: true });
  await writeFile(
    path.join(twoPlayerSrc, "main.ts"),
    'import "./pokerogue-advisor-bridge";\nimport "./pokerogue-advisor-reward-bridge";\n',
    "utf8",
  );
  await writeFile(path.join(twoPlayerSrc, "pokerogue-advisor-bridge.ts"), "// bridge\n", "utf8");
  await writeFile(path.join(twoPlayerSrc, "pokerogue-advisor-reward-bridge.ts"), "// reward\n", "utf8");
  await writeFile(
    path.join(twoPlayerSrc, "utils", "battle-planner-ai.ts"),
    "export function getPlannerAdvisorMoveEvaluations() {}\n",
    "utf8",
  );

  let result = await diagnose2p(twoPlayerRoot);
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 5);

  await rm(path.join(twoPlayerSrc, "pokerogue-advisor-reward-bridge.ts"));
  result = await diagnose2p(twoPlayerRoot);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(check => check.id === "reward-shop-bridge")?.ok, false);

  const officialRoot = path.join(root, "official");
  const officialSrc = path.join(officialRoot, "src");
  await mkdir(officialSrc, { recursive: true });
  await writeFile(path.join(officialSrc, "main.ts"), 'import "./pokerogue-advisor-bridge";\n', "utf8");
  await writeFile(path.join(officialSrc, "pokerogue-advisor-bridge.ts"), "// bridge\n", "utf8");

  let official = await diagnoseOfficial(officialRoot);
  assert.equal(official.ok, true);
  assert.equal(official.checks.length, 2);

  await writeFile(path.join(officialSrc, "main.ts"), "console.log('missing import');\n", "utf8");
  official = await diagnoseOfficial(officialRoot);
  assert.equal(official.ok, false);
  assert.equal(official.checks.find(check => check.id === "capture-import")?.ok, false);

  console.log("PASS integration doctor tests");
} finally {
  await rm(root, { recursive: true, force: true });
}
