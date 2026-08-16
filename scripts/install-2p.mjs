#!/usr/bin/env node
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ADVISOR_IMPORT = 'import "./pokerogue-advisor-bridge";';
const I18N_MARKER = 'import "#app/i18n"; // Initializes i18n on import';

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

export async function installInto2p(gameRoot) {
  const gameSrc = await resolveGameSrc(gameRoot);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const sourceBridge = path.resolve(scriptDir, "..", "integrations", "solvolrund-2p", "pokerogue-advisor-bridge.ts");
  const targetBridge = path.join(gameSrc, "pokerogue-advisor-bridge.ts");
  const mainPath = path.join(gameSrc, "main.ts");

  if (!(await exists(sourceBridge))) {
    throw new Error(`Advisor bridge source not found: ${sourceBridge}`);
  }

  await copyFile(sourceBridge, targetBridge);
  const mainSource = await readFile(mainPath, "utf8");
  const updatedMain = addAdvisorImport(mainSource);
  if (updatedMain !== mainSource) await writeFile(mainPath, updatedMain, "utf8");

  return { gameSrc, targetBridge, mainPath };
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
    console.log("PokeRogue Advisor bridge installed.");
    console.log(`Bridge: ${result.targetBridge}`);
    console.log(`Entry:  ${result.mainPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
