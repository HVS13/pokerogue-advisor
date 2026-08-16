import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installInto2p } from "../scripts/install-2p.mjs";

const plannerFixture = `interface Pokemon {}\ninterface PokemonMove {}\ninterface TurnMove {}\ninterface PlannerMoveChoice { move: { moveId: number; getMove(): { name: string } }; targets: number[]; score: number; breakdown?: Record<string, number>; debug?: { result: string } }\nfunction installPlannerDebugConsoleHelper() {}\nfunction scorePlannerMoveCandidates(user: Pokemon, move: PokemonMove): (PlannerMoveChoice | undefined)[] { return []; }\nfunction scorePlannerChoiceByOneTurnSearch(user: Pokemon, choice: PlannerMoveChoice): PlannerMoveChoice { return choice; }\nfunction chooseFromBestPlannerChoices(user: Pokemon, choices: PlannerMoveChoice[]): PlannerMoveChoice | undefined { return choices[0]; }\nfunction getPlannerMoveTargets() { return []; }\nconst MoveId = { STRUGGLE: 1, NONE: 0 };\nconst MoveUseMode = { IGNORE_PP: 1, NORMAL: 0 };\nexport function choosePlannerMove(user: Pokemon, movePool: PokemonMove[]): TurnMove {\n  installPlannerDebugConsoleHelper();\n\n  const choices = movePool\n    .flatMap(move => scorePlannerMoveCandidates(user, move))\n    .filter((scoredMove): scoredMove is PlannerMoveChoice => !!scoredMove)\n    .map(choice => scorePlannerChoiceByOneTurnSearch(user, choice))\n    .sort((a, b) => b.score - a.score);\n\n  const chosenMove = chooseFromBestPlannerChoices(user, choices);\n  if (!chosenMove) return {} as TurnMove;\n  return {} as TurnMove;\n}\n`;

const root = await mkdtemp(path.join(os.tmpdir(), "pokerogue-advisor-install-"));
try {
  const src = path.join(root, "pokerogue-beta", "src");
  const utils = path.join(src, "utils");
  await mkdir(utils, { recursive: true });
  await writeFile(path.join(src, "main.ts"), 'import "#app/polyfills";\nimport "#app/i18n"; // Initializes i18n on import\n\nconsole.log("game");\n', "utf8");
  await writeFile(path.join(utils, "battle-planner-ai.ts"), plannerFixture, "utf8");

  await installInto2p(root);
  await installInto2p(root);

  const main = await readFile(path.join(src, "main.ts"), "utf8");
  const bridgeImport = 'import "./pokerogue-advisor-bridge";';
  const rewardImport = 'import "./pokerogue-advisor-reward-bridge";';
  assert.equal(main.split(bridgeImport).length - 1, 1, "installer must not duplicate the main bridge import");
  assert.equal(main.split(rewardImport).length - 1, 1, "installer must not duplicate the reward bridge import");
  assert(main.indexOf("#app/i18n") < main.indexOf(bridgeImport), "advisor imports should follow i18n initialization");
  assert(main.indexOf(bridgeImport) < main.indexOf(rewardImport), "reward sidecar should load after the main bridge");

  const bridge = await readFile(path.join(src, "pokerogue-advisor-bridge.ts"), "utf8");
  assert.match(bridge, /PokeRogue Advisor bridge/);

  const rewardBridge = await readFile(path.join(src, "pokerogue-advisor-reward-bridge.ts"), "utf8");
  assert.match(rewardBridge, /Reward\/shop sidecar/);
  assert.match(rewardBridge, /Phaser\.Math\.RND\.state/);

  const planner = await readFile(path.join(utils, "battle-planner-ai.ts"), "utf8");
  assert.equal(
    planner.split("export function getPlannerAdvisorMoveEvaluations(").length - 1,
    1,
    "installer must add exactly one deterministic advisor evaluation export",
  );
  assert.equal(
    planner.split("const choices = getPlannerAdvisorScoredChoices(user, movePool);").length - 1,
    1,
    "existing chooser should reuse the shared deterministic scoring helper exactly once",
  );
  assert.match(planner, /does not call the seeded\/random final-choice selector/);
  assert.doesNotMatch(
    planner.slice(planner.indexOf("export function getPlannerAdvisorMoveEvaluations("), planner.indexOf("export function choosePlannerMove(")),
    /randBattleSeedInt/,
    "advisor evaluation export must not consume battle RNG",
  );

  console.log("PASS cross-platform 2P installer, reward sidecar, and planner hook test");
} finally {
  await rm(root, { recursive: true, force: true });
}
