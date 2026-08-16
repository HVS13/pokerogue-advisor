import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installIntoOfficial } from "../scripts/install-official.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "pokerogue-advisor-official-"));
try {
  const src = path.join(root, "src");
  await mkdir(src, { recursive: true });
  await writeFile(
    path.join(src, "main.ts"),
    'import "#app/polyfills";\nimport "#app/i18n"; // Initializes i18n on import\n\nconsole.log("official");\n',
    "utf8",
  );

  await installIntoOfficial(root);
  await installIntoOfficial(root);

  const main = await readFile(path.join(src, "main.ts"), "utf8");
  const advisorImport = 'import "./pokerogue-advisor-bridge";';
  assert.equal(main.split(advisorImport).length - 1, 1, "official installer must be idempotent");
  assert(main.indexOf("#app/i18n") < main.indexOf(advisorImport));

  const bridge = await readFile(path.join(src, "pokerogue-advisor-bridge.ts"), "utf8");
  assert.match(bridge, /Capture-only PokeRogue Advisor bridge/);
  assert.match(bridge, /getCriticalCaptureChance\(modifiedCatchRate\)/);
  assert.doesNotMatch(bridge, /battle-planner-ai|computer-partner-reward-ai/);

  console.log("PASS official PokeRogue capture installer test");
} finally {
  await rm(root, { recursive: true, force: true });
}
