import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

class FakeElement {
  constructor() { this.children = []; this.style = {}; this.textContent = ""; this.id = ""; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = [...children]; }
  text() { return [this.textContent, ...this.children.map(child => typeof child?.text === "function" ? child.text() : child?.textContent ?? "")].filter(Boolean).join("\n"); }
}
class FakeWindow {
  constructor(origin, hostname) { this.location = { origin, hostname }; this.listeners = new Map(); this.postCount = 0; }
  addEventListener(type, listener) { const listeners = this.listeners.get(type) ?? []; listeners.push(listener); this.listeners.set(type, listeners); }
  postMessage(data, targetOrigin) { this.postCount++; assert.equal(targetOrigin, this.location.origin); const event = { source: this, origin: this.location.origin, data }; for (const listener of this.listeners.get("message") ?? []) listener(event); }
}

const code = await readFile(new URL("../extension/advisor.js", import.meta.url), "utf8");

{
  const window = new FakeWindow("http://localhost:8000", "localhost");
  const documentElement = new FakeElement();
  const document = { title: "PokéRogue", documentElement, createElement() { return new FakeElement(); } };
  window.addEventListener("message", event => {
    if (event.data?.source !== "pokerogue-advisor-extension" || event.data?.type !== "request-snapshot") return;
    window.postMessage({ source: "pokerogue-advisor-game", type: "snapshot", snapshot: {
      version: 1, context: "capture", generatedAt: 456,
      captureTargets: [{ targetId: 77, speciesName: "Garchomp", hp: 40, maxHp: 100, catchRate: 45, statusMultiplier: 1, shinyMultiplier: 1,
        balls: [
          { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.858, resourceRank: 2 },
          { id: "3", name: "Rogue Ball", multiplier: 3, count: 10, probability: 0.86, resourceRank: 3 },
        ] }],
    } }, window.location.origin);
  });
  let intervalCallback;
  const context = vm.createContext({ window, document, console, setInterval(callback) { intervalCallback = callback; return 1; }, clearInterval() {}, setTimeout() { return 1; }, Object, Math, Date, Array, Map, Set, Number, String, Boolean, Error });
  vm.runInContext(code, context, { filename: "advisor.js" });
  assert.equal(typeof intervalCallback, "function", "bundle should schedule advisor polling on a PokeRogue page");
  intervalCallback();
  const rendered = documentElement.text();
  assert.match(rendered, /POKEROGUE ADVISOR/);
  assert.match(rendered, /THROW ULTRA BALL NOW/);
  assert.match(rendered, /EQUIVALENT/);
}

{
  const window = new FakeWindow("http://example.com", "example.com");
  const documentElement = new FakeElement();
  const document = { title: "Unrelated App", documentElement, createElement() { return new FakeElement(); } };
  let intervalStarted = false;
  let retryScheduled = false;
  const context = vm.createContext({
    window,
    document,
    console,
    setInterval() { intervalStarted = true; return 1; },
    clearInterval() {},
    setTimeout() { retryScheduled = true; return 1; },
    Object,
    Math,
    Date,
    Array,
    Map,
    Set,
    Number,
    String,
    Boolean,
    Error,
  });
  vm.runInContext(code, context, { filename: "advisor-unrelated.js" });
  assert.equal(intervalStarted, false, "unrelated pages must not start Advisor polling");
  assert.equal(window.postCount, 0, "unrelated pages must not post Advisor snapshot requests");
  assert.equal(documentElement.children.length, 0, "unrelated pages must not render an overlay");
  assert.equal(retryScheduled, true, "a short passive title-detection retry is allowed");
}

console.log("PASS built extension bundle smoke + unrelated-page inertness test");
