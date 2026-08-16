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

let latestSnapshot: AdvisorSnapshot | undefined;
let listenerInstalled = false;

function isSnapshot(value: unknown): value is AdvisorSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<AdvisorSnapshot>;
  return snapshot.version === 1
    && typeof snapshot.context === "string"
    && typeof snapshot.generatedAt === "number";
}

function installListener(): void {
  if (listenerInstalled) return;
  listenerInstalled = true;

  window.addEventListener("message", event => {
    if (event.source !== window) return;
    const data = event.data as Partial<AdvisorSnapshotMessage> | undefined;
    if (data?.source !== "pokerogue-advisor-game" || data.type !== "snapshot" || !isSnapshot(data.snapshot)) {
      return;
    }
    latestSnapshot = data.snapshot;
  });
}

export function requestSnapshot(): void {
  installListener();
  const request: AdvisorSnapshotRequestMessage = {
    source: "pokerogue-advisor-extension",
    type: "request-snapshot",
  };
  window.postMessage(request, "*");
}

export function getLatestSnapshot(): AdvisorSnapshot | undefined {
  installListener();
  return latestSnapshot;
}
