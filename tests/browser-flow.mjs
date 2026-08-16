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

let responseSnapshot = {
  version: 1, context: "capture", generatedAt: 123,
  captureTargets: [{ targetId: 77, speciesName: "Garchomp", hp: 40, maxHp: 100, catchRate: 45, statusMultiplier: 1, shinyMultiplier: 1,
    balls: [
      { id: "2", name: "Ultra Ball", multiplier: 2, count: 10, probability: 0.858, resourceRank: 2 },
      { id: "3", name: "Rogue Ball", multiplier: 3, count: 10, probability: 0.86, resourceRank: 3 },
    ] }],
};

window.addEventListener("message", event => {
  if (event.data?.source !== "pokerogue-advisor-extension" || event.data?.type !== "request-snapshot") return;
  window.postMessage({ source: "pokerogue-advisor-game", type: "snapshot", snapshot: responseSnapshot }, window.location.origin);
});

requestSnapshot();
let snapshot = getLatestSnapshot();
assert(snapshot);
let recommendations = analyzeSnapshot(snapshot);
assert.equal(recommendations[0].label, "THROW ULTRA BALL NOW");
renderAdvisor(snapshot, recommendations);
let rendered = documentElement.text();
assert.match(rendered, /RECOMMENDATION/);
assert.match(rendered, /THROW ULTRA BALL NOW/);
assert.match(rendered, /EQUIVALENT/);
assert.match(rendered, /preserve the rarer ball/i);

responseSnapshot = {
  version: 1,
  context: "battle",
  generatedAt: 124,
  battle: {
    actorName: "Raichu",
    opponentNames: ["Gyarados"],
    moves: [
      { id: "85:1", name: "Thunderbolt", plannerScore: 130, target: "Gyarados", reasons: ["Strong offensive value."] },
      { id: "58:1", name: "Ice Beam", plannerScore: 90, target: "Gyarados" },
    ],
  },
};
requestSnapshot();
snapshot = getLatestSnapshot();
assert.equal(snapshot?.context, "battle");
recommendations = analyzeSnapshot(snapshot);
assert.equal(recommendations[0].label, "USE THUNDERBOLT → GYARADOS");
assert.equal(recommendations[0].decisionStrength, "strong");
renderAdvisor(snapshot, recommendations);
rendered = documentElement.text();
assert.match(rendered, /BATTLE/);
assert.match(rendered, /USE THUNDERBOLT → GYARADOS/);
assert.match(rendered, /STRONG/);
assert.match(rendered, /Strong offensive value/);

responseSnapshot = {
  version: 1,
  context: "reward-shop",
  generatedAt: 125,
  rewards: [
    { id: "0:MULTI_LENS", name: "Multi Lens", score: 24000, reason: "priority Rogue reward", target: "Garchomp" },
    { id: "1:EXP_CHARM", name: "EXP Charm", score: 16000, reason: "useful progression reward" },
  ],
  shop: [
    { id: "0:REVIVE", name: "Revive", score: 95, cost: 1200, reason: "revives a fainted Pokemon", target: "Raichu", emergency: true, reserveCost: 1800, moneyAfterPurchase: 3800 },
    { id: "1:POTION", name: "Potion", score: 120, cost: 200, reason: "heals meaningful HP loss", target: "Garchomp", emergency: false, reserveCost: 1800, moneyAfterPurchase: 4800 },
  ],
  shopMoney: 5000,
  shopReserve: 1800,
};
requestSnapshot();
snapshot = getLatestSnapshot();
assert.equal(snapshot?.context, "reward-shop");
recommendations = analyzeSnapshot(snapshot);
assert.equal(recommendations[0].label, "PICK MULTI LENS");
assert.equal(recommendations[1].label, "BUY REVIVE");
assert.equal(recommendations[0].isDecision, true);
assert.equal(recommendations[1].isDecision, true);
renderAdvisor(snapshot, recommendations);
rendered = documentElement.text();
assert.match(rendered, /REWARD-SHOP/);
assert.match(rendered, /PICK MULTI LENS/);
assert.match(rendered, /BUY REVIVE/);
assert.match(rendered, /Best target: Garchomp/);
assert.match(rendered, /Emergency recovery need takes priority/);

console.log("PASS simulated bridge -> extension -> capture+battle+reward-shop decisions -> overlay test");
