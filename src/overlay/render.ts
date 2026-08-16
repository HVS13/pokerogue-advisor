import type { AdvisorRecommendation, AdvisorSnapshot } from "../core/types.js";

let root: HTMLDivElement | undefined;
let visible = true;

function addText(parent: HTMLElement, text: string, opacity?: string): HTMLDivElement {
  const line = document.createElement("div");
  line.textContent = text;
  if (opacity) line.style.opacity = opacity;
  parent.appendChild(line);
  return line;
}

function ensureRoot(): HTMLDivElement {
  if (root) return root;
  root = document.createElement("div");
  root.id = "pokerogue-advisor-overlay";
  Object.assign(root.style, {
    position: "fixed",
    right: "16px",
    top: "16px",
    width: "340px",
    maxHeight: "76vh",
    overflow: "auto",
    zIndex: "2147483647",
    background: "rgba(12, 14, 18, 0.94)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "10px",
    padding: "12px",
    font: "13px/1.4 system-ui, sans-serif",
    boxShadow: "0 8px 30px rgba(0,0,0,.35)",
  });
  document.documentElement.appendChild(root);
  return root;
}

function pct(value?: number): string {
  return value === undefined ? "" : `${(value * 100).toFixed(1)}%`;
}

export function setAdvisorVisible(nextVisible: boolean): void {
  visible = nextVisible;
  if (root) root.style.display = visible ? "block" : "none";
}

export function renderAdvisor(snapshot: AdvisorSnapshot, recommendations: AdvisorRecommendation[]): void {
  const el = ensureRoot();
  el.style.display = visible ? "block" : "none";
  el.replaceChildren();

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  });

  const title = document.createElement("strong");
  title.textContent = "POKEROGUE ADVISOR";
  const context = document.createElement("span");
  context.textContent = snapshot.context.toUpperCase();
  context.style.opacity = ".6";
  header.append(title, context);
  el.appendChild(header);

  const shown = snapshot.context === "capture" ? recommendations : recommendations.slice(0, 5);
  if (shown.length === 0) {
    addText(el, snapshot.notice ?? "Waiting for a decision...", ".7");
    addText(el, "F8: show/hide", ".5").style.marginTop = "8px";
    return;
  }

  for (const rec of shown) {
    const card = document.createElement("div");
    Object.assign(card.style, {
      padding: rec.isDecision ? "12px 0" : "9px 0",
      borderTop: "1px solid rgba(255,255,255,.1)",
    });

    if (rec.isDecision) {
      const kicker = addText(card, "RECOMMENDATION", ".62");
      kicker.style.fontSize = "11px";
      kicker.style.letterSpacing = ".08em";
    }

    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", gap: "8px", alignItems: "baseline" });
    const label = document.createElement("strong");
    label.textContent = `${rec.rank && !rec.isDecision ? `${rec.rank}. ` : ""}${rec.label}`;
    const metric = document.createElement("span");
    metric.style.marginLeft = "auto";
    metric.textContent = rec.isDecision && rec.decisionStrength
      ? rec.decisionStrength.toUpperCase()
      : rec.probability !== undefined
        ? pct(rec.probability)
        : rec.confidence !== undefined
          ? `${pct(rec.confidence)} confidence`
          : rec.score.toFixed(0);
    row.append(label, metric);
    card.appendChild(row);

    for (const reason of rec.reason) addText(card, reason, ".78");
    for (const warning of rec.warnings ?? []) addText(card, `Warning: ${warning}`, ".85");
    el.appendChild(card);
  }

  addText(el, "F8: show/hide", ".5").style.marginTop = "8px";
}
