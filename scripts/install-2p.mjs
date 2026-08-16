#!/usr/bin/env node
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ADVISOR_IMPORT = 'import "./pokerogue-advisor-bridge";';
const I18N_MARKER = 'import "#app/i18n"; // Initializes i18n on import';
const PLANNER_ADVISOR_MARKER = "export function getPlannerAdvisorMoveEvaluations(";
const PLANNER_CHOICE_START = `export function choosePlannerMove(user: Pokemon, movePool: PokemonMove[]): TurnMove {\n  installPlannerDebugConsoleHelper();\n\n  const choices = movePool\n    .flatMap(move => scorePlannerMoveCandidates(user, move))\n    .filter((scoredMove): scoredMove is PlannerMoveChoice => !!scoredMove)\n    .map(choice => scorePlannerChoiceByOneTurnSearch(user, choice))\n    .sort((a, b) => b.score - a.score);`;
const PLANNER_CHOICE_REPLACEMENT = `function getPlannerAdvisorScoredChoices(user: Pokemon, movePool: PokemonMove[]): PlannerMoveChoice[] {\n  return movePool\n    .flatMap(move => scorePlannerMoveCandidates(user, move))\n    .filter((scoredMove): scoredMove is PlannerMoveChoice => !!scoredMove)\n    .map(choice => scorePlannerChoiceByOneTurnSearch(user, choice))\n    .sort((a, b) => b.score - a.score);\n}\n\n/**\n * Read-only deterministic planner evaluations for PokeRogue Advisor.\n * This deliberately does not call the seeded/random final-choice selector.\n */\nexport function getPlannerAdvisorMoveEvaluations(user: Pokemon, movePool: PokemonMove[]) {\n  installPlannerDebugConsoleHelper();\n  return getPlannerAdvisorScoredChoices(user, movePool).map(choice => ({\n    moveId: choice.move.moveId,\n    moveName: choice.move.getMove().name,\n    targets: [...choice.targets],\n    score: choice.score,\n    breakdown: choice.breakdown ? { ...choice.breakdown } : undefined,\n    result: choice.debug?.result,\n  }));\n}\n\nexport function choosePlannerMove(user: Pokemon, movePool: PokemonMove[]): TurnMove {\n  installPlannerDebugConsoleHelper();\n\n  const choices = getPlannerAdvisorScoredChoices(user, movePool);`;

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveGameSrc(gameRoot) {
  const root = path.resolve(gameRoot);
  const candidates = [
    path.join(root, "pokerogue-beta", "src"),
    path.join(root, "src"),
  ];

  for (const candidate of candidates) {
    if (await exists(path.join(candidate, "main.ts"))) return candidate;
  }

  throw new Error(
    `Could not find src/main.ts under '${root}'. Pass either the pokerogue-2p-beta repo root or its pokerogue-beta folder.`,
  );
}

export function addAdvisorImport(mainSource) {
  if (mainSource.includes(ADVISOR_IMPORT)) return mainSource;

  const newline = mainSource.includes("\r\n") ? "\r\n" : "\n";
  if (mainSource.includes(I18N_MARKER)) {
    return mainSource.replace(I18N_MARKER, `${I18N_MARKER}${newline}${ADVISOR_IMPORT}`);
  }

  return `${ADVISOR_IMPORT}${newline}${mainSource}`;
}

export function addPlannerAdvisorHook(plannerSource) {
  if (plannerSource.includes(PLANNER_ADVISOR_MARKER)) return plannerSource;

  const normalized = plannerSource.replaceAll("\r\n", "\n");
  if (!normalized.includes(PLANNER_CHOICE_START)) {
    throw new Error(
      "Could not locate the expected choosePlannerMove scoring block. The 2P planner likely changed; update the advisor integration instead of guessing a patch.",
    );
  }

  const updated = normalized.replace(PLANNER_CHOICE_START, PLANNER_CHOICE_REPLACEMENT);
  return plannerSource.includes("\r\n") ? updated.replaceAll("\n", "\r\n") : updated;
}

export async function installInto2p(gameRoot) {
  const gameSrc = await resolveGameSrc(gameRoot);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const sourceBridge = path.resolve(scriptDir, "..", "integrations", "solvolrund-2p", "pokerogue-advisor-bridge.ts");
  const targetBridge = path.join(gameSrc, "pokerogue-advisor-bridge.ts");
  const mainPath = path.join(gameSrc, "main.ts");
  const plannerPath = path.join(gameSrc, "utils", "battle-planner-ai.ts");

  if (!(await exists(sourceBridge))) {
    throw new Error(`Advisor bridge source not found: ${sourceBridge}`);
  }
  if (!(await exists(plannerPath))) {
    throw new Error(`2P battle planner not found: ${plannerPath}`);
  }

  await copyFile(sourceBridge, targetBridge);

  const mainSource = await readFile(mainPath, "utf8");
  const updatedMain = addAdvisorImport(mainSource);
  if (updatedMain !== mainSource) await writeFile(mainPath, updatedMain, "utf8");

  const plannerSource = await readFile(plannerPath, "utf8");
  const updatedPlanner = addPlannerAdvisorHook(plannerSource);
  if (updatedPlanner !== plannerSource) await writeFile(plannerPath, updatedPlanner, "utf8");

  return { gameSrc, targetBridge, mainPath, plannerPath };
}

async function main() {
  const gameRoot = process.argv[2];
  if (!gameRoot) {
    console.error('Usage: node scripts/install-2p.mjs "C:\\path\\to\\pokerogue-2p-beta"');
    process.exitCode = 2;
    return;
  }

  try {
    const result = await installInto2p(gameRoot);
    console.log("PokeRogue Advisor integration installed.");
    console.log(`Bridge:  ${result.targetBridge}`);
    console.log(`Entry:   ${result.mainPath}`);
    console.log(`Planner: ${result.plannerPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
