#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRIDGE_IMPORT = 'import "./pokerogue-advisor-bridge";';
const REWARD_IMPORT = 'import "./pokerogue-advisor-reward-bridge";';
const PLANNER_MARKER = "export function getPlannerAdvisorMoveEvaluations(";

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveSrc(gameRoot) {
  const root = path.resolve(gameRoot);
  const candidates = [path.join(root, "pokerogue-beta", "src"), path.join(root, "src")];
  for (const src of candidates) {
    if (await exists(path.join(src, "main.ts"))) return src;
  }
  throw new Error(`Could not find the PokeRogue 2P src folder under '${root}'.`);
}

export async function diagnose2p(gameRoot) {
  const src = await resolveSrc(gameRoot);
  const mainPath = path.join(src, "main.ts");
  const plannerPath = path.join(src, "utils", "battle-planner-ai.ts");
  const main = await readFile(mainPath, "utf8");
  const planner = await readFile(plannerPath, "utf8").catch(() => "");

  const checks = [
    {
      id: "capture-battle-bridge",
      ok: await exists(path.join(src, "pokerogue-advisor-bridge.ts")),
      detail: "src/pokerogue-advisor-bridge.ts",
    },
    {
      id: "reward-shop-bridge",
      ok: await exists(path.join(src, "pokerogue-advisor-reward-bridge.ts")),
      detail: "src/pokerogue-advisor-reward-bridge.ts",
    },
    {
      id: "capture-battle-import",
      ok: main.includes(BRIDGE_IMPORT),
      detail: BRIDGE_IMPORT,
    },
    {
      id: "reward-shop-import",
      ok: main.includes(REWARD_IMPORT),
      detail: REWARD_IMPORT,
    },
    {
      id: "planner-hook",
      ok: planner.includes(PLANNER_MARKER),
      detail: PLANNER_MARKER,
    },
  ];

  return {
    target: "SolVolrund PokeRogue 2P",
    src,
    ok: checks.every(check => check.ok),
    checks,
  };
}

function print(result) {
  console.log(`PokeRogue Advisor doctor: ${result.target}`);
  console.log(`Game src: ${result.src}`);
  for (const check of result.checks) {
    console.log(`${check.ok ? "OK" : "MISSING"}  ${check.id}  ${check.detail}`);
  }
  console.log(result.ok ? "RESULT: READY" : "RESULT: INCOMPLETE - run the 2P Advisor installer again.");
}

async function main() {
  const gameRoot = process.argv[2];
  if (!gameRoot) {
    console.error('Usage: node integrations/solvolrund-2p/doctor.mjs "C:\\path\\to\\pokerogue-2p-beta"');
    process.exitCode = 2;
    return;
  }

  try {
    const result = await diagnose2p(gameRoot);
    print(result);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
