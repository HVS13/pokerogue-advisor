import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NON_IDLE_SNAPSHOT_GRACE_MS, shouldAcceptSnapshot } from "../dist/bridge/api.js";
import { isKnownPokeRogueHost, isLikelyPokeRoguePage } from "../dist/bridge/page-detection.js";
import { getSnapshotContentKey } from "../dist/core/snapshot-key.js";

const idle = { version: 1, context: "idle", notice: "waiting", generatedAt: 100 };
const reward = {
  version: 1,
  context: "reward-shop",
  generatedAt: 101,
  rewards: [{ id: "lens", name: "Multi Lens", score: 100 }],
  shop: [],
};
const battle = {
  version: 1,
  context: "battle",
  generatedAt: 102,
  battle: { actorName: "Raichu", opponentNames: ["Gyarados"], moves: [] },
};

assert.equal(shouldAcceptSnapshot(undefined, 0, idle, 10), true);
assert.equal(shouldAcceptSnapshot(idle, 10, reward, 20), true, "real decisions must replace idle immediately");
assert.equal(shouldAcceptSnapshot(reward, 20, idle, 20 + NON_IDLE_SNAPSHOT_GRACE_MS - 1), false, "same-cycle idle fallback must not overwrite reward/shop");
assert.equal(shouldAcceptSnapshot(reward, 20, idle, 20 + NON_IDLE_SNAPSHOT_GRACE_MS), true, "idle should eventually clear a stale decision after the grace window");
assert.equal(shouldAcceptSnapshot(reward, 20, battle, 21), true, "a new real decision context may replace another real context immediately");

const rewardLater = { ...reward, generatedAt: 999999 };
assert.equal(getSnapshotContentKey(reward), getSnapshotContentKey(rewardLater), "transport timestamps must not trigger rerenders");
assert.notEqual(getSnapshotContentKey(reward), getSnapshotContentKey({ ...reward, shopMoney: 5000 }), "decision content changes must trigger rerenders");

assert.equal(isKnownPokeRogueHost("pokerogue.net"), true);
assert.equal(isKnownPokeRogueHost("beta.pokerogue.net"), true);
assert.equal(isKnownPokeRogueHost("example.com"), false);
assert.equal(isLikelyPokeRoguePage("192.168.1.20", "PokéRogue"), true, "LAN game pages should activate by title");
assert.equal(isLikelyPokeRoguePage("26.12.34.56", "PokeRogue (Beta)"), true, "VPN/LAN hosts should not require a private-IP assumption");
assert.equal(isLikelyPokeRoguePage("example.com", "Unrelated App"), false, "unrelated HTTP pages must stay inert");

const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
const matches = manifest.content_scripts?.flatMap(script => script.matches ?? []) ?? [];
assert.equal(matches.includes("https://*/*"), false, "extension must not inject into every HTTPS website");
assert(matches.includes("https://pokerogue.net/*") || matches.includes("https://*.pokerogue.net/*"), "official PokeRogue HTTPS host must remain covered");
assert(matches.includes("http://*/*"), "arbitrary LAN/VPN HTTP hosts must remain supported");

console.log("PASS snapshot routing, render stability, page detection, and manifest-scope tests");
