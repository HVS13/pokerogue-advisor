import assert from "node:assert/strict";

class FakeElement {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.textContent = ""; this.id = ""; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = [...children]; }
  text() { return [this.textContent, ...this.children.map(child => typeof child?.text === "function" ? child.text() : child?.textContent ?? "")].filter(Boolean).join("\n"); }
}

class FakeWindow {
  constructor() { this.location = { origin: "http://localhost:8000" }; this.listeners = new Map(); }
  addEventListener(type, listener) { const listeners = this.listeners.get(type) ?? []; listeners.push(listener); this.listeners.set(type, listeners); }
  postMessage(data, targetOrigin) { assert.equal(targetOrigin, this.location.origin); const event = { source: this, origin: this.location.origin, data }; for (const listener of this.listeners.get("message") ?? []) listener(event); }
  emitForeignMessage(data) { const event = { source: this, origin: "https://evil.example", data }; for (const listener of this.listeners.get("message") ?? []) listener(event); }
}

const window = new FakeWindow();
const documentElement = new FakeElement("html");
globalThis.window = window;
globalThis.document = { documentElement, createElement(tag) { return new FakeElement(tag); } };

const { requestSnapshot, getLatestSnapshot } = await import("../dist/bridge/api.js");
const { analyzeSnapshot } = await import("../dist/core/advisor.js");
const { renderAdvisor } = await import("../dist/overlay/render.js");

requestSnapshot();
window.emitForeignMessage({ source: "pokerogue-advisor-game", type: "snapshot", snapshot: { version: 1, context: "idle", generatedAt: 1, notice: "malicious" } });
assert.equal(getLatestSnapshot(), undefined, "foreign-origin snapshots must be ignored");

window.addEventListener("message", event => {
  if (event.data?.source !== "pokerogue-advisor-extension" || event.data?.type !== "request-snapshot") return;
  window.postMessage({ source: "pokerogue-advisor-game", type: "snapshot", snapshot: {
    version: 1, context: "capture", generatedAt: 123,
    captureTargets: [{ targetId: 77, speciesName: "Garchomp", hp: 40, maxHp: 100, catchRate: 45, statusMultiplier: 1, shinyMultiplier: 1,
      balls: [
        { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.858, resourceRank: 2 },
        { id: "3", name: "Rogue Ball", multiplier: 3, count: 10, probability: 0.86, resourceRank: 3 },
      ] }],
  } }, window.location.origin);
});

requestSnapshot();
const snapshot = getLatestSnapshot();
assert(snapshot);
const recommendations = analyzeSnapshot(snapshot);
assert.equal(recommendations[0].label, "THROW ULTRA BALL NOW");
renderAdvisor(snapshot, recommendations);
const rendered = documentElement.text();
assert.match(rendered, /RECOMMENDATION/);
assert.match(rendered, /THROW ULTRA BALL NOW/);
assert.match(rendered, /EQUIVALENT/);
assert.match(rendered, /preserve the rarer ball/i);
console.log("PASS simulated bridge -> extension -> decision -> overlay test");
