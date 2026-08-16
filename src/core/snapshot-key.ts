import type { AdvisorSnapshot } from "./types.js";

/** Adapters may update generatedAt on every poll; rendering should depend on decision content. */
export function getSnapshotContentKey(snapshot: AdvisorSnapshot): string {
  const { generatedAt: _generatedAt, ...content } = snapshot;
  return JSON.stringify(content);
}
