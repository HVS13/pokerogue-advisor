import { getLatestSnapshot, requestSnapshot } from "./bridge/api.js";
import { isLikelyPokeRoguePage } from "./bridge/page-detection.js";
import { analyzeSnapshot } from "./core/advisor.js";
import { getSnapshotContentKey } from "./core/snapshot-key.js";
import type { AdvisorSnapshot } from "./core/types.js";
import { renderAdvisor, setAdvisorVisible } from "./overlay/render.js";

const DETECTION_RETRIES = 20;
const DETECTION_RETRY_MS = 250;

let startedAt = 0;
let lastSnapshotKey: string | undefined;
let visible = true;
let disconnectedRendered = false;
let pollingStarted = false;

function renderDisconnectedState(): void {
  if (disconnectedRendered) return;
  disconnectedRendered = true;
  const snapshot: AdvisorSnapshot = {
    version: 1,
    context: "idle",
    notice: "Game bridge not detected. Install a supported PokeRogue adapter and reload the game.",
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
  const snapshotKey = getSnapshotContentKey(snapshot);
  if (snapshotKey === lastSnapshotKey) return;
  lastSnapshotKey = snapshotKey;
  renderAdvisor(snapshot, analyzeSnapshot(snapshot));
}

function startAdvisor(): void {
  if (pollingStarted) return;
  pollingStarted = true;
  startedAt = Date.now();

  window.addEventListener("keydown", event => {
    if (event.key !== "F8") return;
    visible = !visible;
    setAdvisorVisible(visible);
  });

  setInterval(tick, 150);
  requestSnapshot();
}

function detectAndStart(attempt = 0): void {
  if (isLikelyPokeRoguePage(window.location.hostname, document.title)) {
    startAdvisor();
    return;
  }

  if (attempt >= DETECTION_RETRIES) return;
  setTimeout(() => detectAndStart(attempt + 1), DETECTION_RETRY_MS);
}

detectAndStart();
