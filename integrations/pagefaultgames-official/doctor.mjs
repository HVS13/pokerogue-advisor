#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRIDGE_IMPORT = 'import "./pokerogue-advisor-bridge";';

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function diagnoseOfficial(gameRoot) {
  const root = path.resolve(gameRoot);
  const src = path.join(root, "src");
  const mainPath = path.join(src, "main.ts");
  if (!(await exists(mainPath))) {
    throw new Error(`Could not find official PokeRogue src/main.ts under '${root}'.`);
  }

  const main = await readFile(mainPath, "utf8");
  const checks = [
    {
      id: "capture-bridge",
      ok: await exists(path.join(src, "pokerogue-advisor-bridge.ts")),
      detail: "src/pokerogue-advisor-bridge.ts",
    },
    {
      id: "capture-import",
      ok: main.includes(BRIDGE_IMPORT),
      detail: BRIDGE_IMPORT,
    },
  ];

  return {
    target: "Pagefault Games official PokeRogue",
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
  console.log(result.ok ? "RESULT: READY" : "RESULT: INCOMPLETE - run the official Advisor installer again.");
}

async function main() {
  const gameRoot = process.argv[2];
  if (!gameRoot) {
    console.error('Usage: node integrations/pagefaultgames-official/doctor.mjs "C:\\path\\to\\pokerogue"');
    process.exitCode = 2;
    return;
  }

  try {
    const result = await diagnoseOfficial(gameRoot);
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
