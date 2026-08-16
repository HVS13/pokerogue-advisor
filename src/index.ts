import { getLatestSnapshot, requestSnapshot } from "./bridge/api.js";
import { analyzeSnapshot } from "./core/advisor.js";
import type { AdvisorSnapshot } from "./core/types.js";
import { renderAdvisor, setAdvisorVisible } from "./overlay/render.js";

const startedAt = Date.now();
let lastGeneratedAt = -1;
let visible = true;
let disconnectedRendered = false;

function renderDisconnectedState(): void {
  if (disconnectedRendered) return;
  disconnectedRendered = true;
  const snapshot: AdvisorSnapshot = {
    version: 1,
    context: "idle",
    notice: "Game bridge not detected. Install the PokeRogue 2P adapter and reload the game.",
    generatedAt: Date.now(),
  };
  renderAdvisor(snapshot, []);
}

function tick(): void {
  requestSnapshot();
  const snapshot = getLatestSnapshot();
  if (!snapshot) {
    if (Date.now() - startedAt >= 1500) renderDisconnectedState();
    return;
  }

  disconnectedRendered = false;
  if (snapshot.generatedAt === lastGeneratedAt) return;
  lastGeneratedAt = snapshot.generatedAt;
  renderAdvisor(snapshot, analyzeSnapshot(snapshot));
}

window.addEventListener("keydown", event => {
  if (event.key !== "F8") return;
  visible = !visible;
  setAdvisorVisible(visible);
});

setInterval(tick, 150);
requestSnapshot();
