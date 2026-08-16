import { getLatestSnapshot, requestSnapshot } from "./bridge/api.js";
import { analyzeSnapshot } from "./core/advisor.js";
import { renderAdvisor, setAdvisorVisible } from "./overlay/render.js";

let lastGeneratedAt = -1;
let visible = true;

function tick(): void {
  requestSnapshot();
  const snapshot = getLatestSnapshot();
  if (!snapshot || snapshot.generatedAt === lastGeneratedAt) return;
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
