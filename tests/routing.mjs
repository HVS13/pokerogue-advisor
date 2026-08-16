import assert from "node:assert/strict";
import { NON_IDLE_SNAPSHOT_GRACE_MS, shouldAcceptSnapshot } from "../dist/bridge/api.js";
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

console.log("PASS snapshot routing arbitration and stable render-key tests");
