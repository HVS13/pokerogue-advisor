import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installInto2p } from "../scripts/install-2p.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "pokerogue-advisor-install-"));
try {
  const src = path.join(root, "pokerogue-beta", "src");
  await mkdir(src, { recursive: true });
  await writeFile(path.join(src, "main.ts"), 'import "#app/polyfills";\nimport "#app/i18n"; // Initializes i18n on import\n\nconsole.log("game");\n', "utf8");
  await installInto2p(root);
  await installInto2p(root);
  const main = await readFile(path.join(src, "main.ts"), "utf8");
  const importCount = main.split('import "./pokerogue-advisor-bridge";').length - 1;
  assert.equal(importCount, 1, "installer must be idempotent");
  assert.match(main, /#app\/i18n[\s\S]*pokerogue-advisor-bridge/);
  const bridge = await readFile(path.join(src, "pokerogue-advisor-bridge.ts"), "utf8");
  assert.match(bridge, /PokeRogue Advisor bridge/);
  console.log("PASS cross-platform 2P installer test");
} finally {
  await rm(root, { recursive: true, force: true });
}
