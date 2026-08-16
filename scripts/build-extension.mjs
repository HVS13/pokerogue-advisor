#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const entry = path.join(projectRoot, "src", "index.ts");
const outFile = path.join(projectRoot, "extension", "advisor.js");

async function loadTypescript() {
  try {
    return await import("typescript");
  } catch {
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    const requireFromGlobal = createRequire(path.join(globalRoot, "__pokerogue_advisor__.cjs"));
    return requireFromGlobal("typescript");
  }
}

const tsModule = await loadTypescript();
const ts = tsModule.default ?? tsModule;

function moduleId(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function resolveImport(fromFile, request) {
  if (!request.startsWith(".")) {
    throw new Error(`Unexpected runtime dependency '${request}' in ${moduleId(fromFile)}`);
  }
  const fromDir = path.dirname(fromFile);
  const resolvedJs = path.resolve(fromDir, request);
  const candidates = [
    resolvedJs.replace(/\.js$/, ".ts"),
    `${resolvedJs}.ts`,
    path.join(resolvedJs, "index.ts"),
  ];
  return candidates[0];
}

const modules = new Map();

async function collect(filePath) {
  const absolute = path.resolve(filePath);
  if (modules.has(absolute)) return;
  const source = await readFile(absolute, "utf8");
  modules.set(absolute, source);

  const info = ts.preProcessFile(source, true, true);
  for (const imported of info.importedFiles) {
    if (!imported.fileName.startsWith(".")) continue;
    const dep = resolveImport(absolute, imported.fileName);
    await collect(dep);
  }
}

await collect(entry);

const compiled = [];
for (const [filePath, source] of modules) {
  const result = ts.transpileModule(source, {
    fileName: filePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      esModuleInterop: false,
    },
  });
  compiled.push(`${JSON.stringify(moduleId(filePath))}: function(require, module, exports) {\n${result.outputText}\n}`);
}

const bundle = `(() => {\n"use strict";\nconst __modules = {\n${compiled.join(",\n")}\n};\nconst __cache = Object.create(null);\nfunction __normalize(baseId, request) {\n  const base = baseId.split("/");\n  base.pop();\n  for (const part of request.split("/")) {\n    if (!part || part === ".") continue;\n    if (part === "..") base.pop(); else base.push(part);\n  }\n  let id = base.join("/");\n  if (id.endsWith(".js")) id = id.slice(0, -3) + ".ts";\n  if (!id.endsWith(".ts")) id += ".ts";\n  return id;\n}\nfunction __require(id) {\n  if (__cache[id]) return __cache[id].exports;\n  const factory = __modules[id];\n  if (!factory) throw new Error("PokeRogue Advisor bundle missing module: " + id);\n  const module = { exports: {} };\n  __cache[id] = module;\n  const localRequire = request => __require(__normalize(id, request));\n  factory(localRequire, module, module.exports);\n  return module.exports;\n}\n__require("src/index.ts");\n})();\n`;

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, bundle, "utf8");
console.log(`Built ${path.relative(projectRoot, outFile)} (${Buffer.byteLength(bundle)} bytes)`);
