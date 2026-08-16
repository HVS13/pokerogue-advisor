import type { AdvisorSnapshot } from "../core/types.js";
import type {
  AdvisorSnapshotMessage,
  AdvisorSnapshotRequestMessage,
  PokerogueAdvisorBridge,
} from "./api.js";

/**
 * Integration point to adapt inside the PokeRogue source tree.
 *
 * Keep this API read-only. Convert live game objects to plain serializable data before
 * returning them. The extension communicates through window.postMessage because normal
 * browser-extension content scripts run in an isolated JavaScript world.
 */
export function installPokerogueAdvisorBridge(getSnapshot: () => AdvisorSnapshot): void {
  const bridge: PokerogueAdvisorBridge = {
    version: 1,
    getSnapshot,
  };

  window.pokerogueAdvisor = bridge;

  window.addEventListener("message", event => {
    if (event.source !== window) return;
    const request = event.data as Partial<AdvisorSnapshotRequestMessage> | undefined;
    if (request?.source !== "pokerogue-advisor-extension" || request.type !== "request-snapshot") {
      return;
    }

    const message: AdvisorSnapshotMessage = {
      source: "pokerogue-advisor-game",
      type: "snapshot",
      snapshot: bridge.getSnapshot(),
    };
    window.postMessage(message, "*");
  });
}
