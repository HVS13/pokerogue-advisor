import type { AdvisorSnapshot } from "../core/types.js";

export interface PokerogueAdvisorBridge {
  version: 1;
  getSnapshot(): AdvisorSnapshot;
}

export interface AdvisorSnapshotMessage {
  source: "pokerogue-advisor-game";
  type: "snapshot";
  snapshot: AdvisorSnapshot;
}

export interface AdvisorSnapshotRequestMessage {
  source: "pokerogue-advisor-extension";
  type: "request-snapshot";
}

declare global {
  interface Window {
    pokerogueAdvisor?: PokerogueAdvisorBridge;
  }
}

/**
 * A real decision provider gets a short grace period over an idle fallback.
 * This prevents the 2P battle/capture bridge's idle response from briefly
 * overwriting the reward/shop sidecar on the same polling cycle.
 */
export const NON_IDLE_SNAPSHOT_GRACE_MS = 250;

let latestSnapshot: AdvisorSnapshot | undefined;
let latestSnapshotReceivedAt = 0;
let listenerInstalled = false;

function isSnapshot(value: unknown): value is AdvisorSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<AdvisorSnapshot>;
  return snapshot.version === 1
    && typeof snapshot.context === "string"
    && typeof snapshot.generatedAt === "number";
}

export function shouldAcceptSnapshot(
  previous: AdvisorSnapshot | undefined,
  previousReceivedAt: number,
  next: AdvisorSnapshot,
  now: number,
): boolean {
  if (!previous) return true;
  if (next.context !== "idle") return true;
  if (previous.context === "idle") return true;

  return now - previousReceivedAt >= NON_IDLE_SNAPSHOT_GRACE_MS;
}

function installListener(): void {
  if (listenerInstalled) return;
  listenerInstalled = true;

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data as Partial<AdvisorSnapshotMessage> | undefined;
    if (data?.source !== "pokerogue-advisor-game" || data.type !== "snapshot" || !isSnapshot(data.snapshot)) {
      return;
    }

    const now = Date.now();
    if (!shouldAcceptSnapshot(latestSnapshot, latestSnapshotReceivedAt, data.snapshot, now)) return;
    latestSnapshot = data.snapshot;
    latestSnapshotReceivedAt = now;
  });
}

export function requestSnapshot(): void {
  installListener();
  const request: AdvisorSnapshotRequestMessage = {
    source: "pokerogue-advisor-extension",
    type: "request-snapshot",
  };
  window.postMessage(request, window.location.origin);
}

export function getLatestSnapshot(): AdvisorSnapshot | undefined {
  installListener();
  return latestSnapshot;
}
