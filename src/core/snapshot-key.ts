import type { AdvisorSnapshot } from "./types.js";

/**
 * Adapters may update generatedAt on every poll. Rendering should depend on
 * decision content, not the transport timestamp.
 */
export function getSnapshotContentKey(snapshot: AdvisorSnapshot): string {
  const { generatedAt: _generatedAt, ...content } = snapshot;
  return JSON.stringify(content);
}
