import { GameState } from "../state";
import {
  OBSERVERS,
  FACTS,
  OBSERVER_LABELS,
  FACT_LABELS,
  CellState,
  anyoneHasFullPicture,
} from "../ledger";

const CELL_GLYPH: Record<CellState, string> = {
  unknown: "·",
  seen: "◉",
  logged: "■",
  warrant: "▣",
  split: "◔",
};

const CELL_TITLE: Record<CellState, string> = {
  unknown: "Unknown — they never learned this",
  seen: "Seen — they know it right now",
  logged: "Logged — they know it and keep a record",
  warrant: "Held — only releasable with a warrant",
  split: "Fragment — useless without the other Tor nodes",
};

export function renderLedger(root: HTMLElement, state: GameState, onClose: () => void): void {
  const l = state.ledger;
  const exposed = anyoneHasFullPicture(l);

  let html = `
    <div class="ledger-panel">
      <div class="ledger-head">
        <div class="ledger-title">WHO KNOWS WHAT</div>
        <button class="ledger-close">✕</button>
      </div>
      <div class="ledger-sub">For every observer in the network, what did they learn about this job?</div>
      <table class="ledger-grid">
        <thead>
          <tr>
            <th class="rowhead"></th>
            ${FACTS.map((f) => `<th title="${FACT_LABELS[f]}">${FACT_LABELS[f]}</th>`).join("")}
          </tr>
        </thead>
        <tbody>`;

  for (const o of OBSERVERS) {
    const rowKnowsSomething = FACTS.some((f) => l[o][f] !== "unknown");
    html += `<tr class="${rowKnowsSomething ? "" : "dim"} ${o === "tor" ? "tor-row" : ""}">
      <td class="rowhead">${OBSERVER_LABELS[o]}</td>`;
    for (const f of FACTS) {
      const st = l[o][f];
      html += `<td class="cell state-${st}" title="${OBSERVER_LABELS[o]} — ${FACT_LABELS[f]}: ${CELL_TITLE[st]}">${CELL_GLYPH[st]}</td>`;
    }
    html += `</tr>`;
  }

  html += `
        </tbody>
      </table>
      <div class="ledger-legend">
        <span><b>${CELL_GLYPH.seen}</b> seen</span>
        <span><b>${CELL_GLYPH.logged}</b> logged</span>
        <span><b>${CELL_GLYPH.warrant}</b> warrant-only</span>
        <span><b>${CELL_GLYPH.split}</b> fragment</span>
        <span><b>${CELL_GLYPH.unknown}</b> unknown</span>
      </div>
      <div class="ledger-verdict ${exposed ? "bad" : "good"}">
        ${
          exposed
            ? "⚠ One observer holds your whole story. If the Authority compels them, they can build a case."
            : "✓ No single observer holds the whole story. Compartmentalized — your trail is in pieces."
        }
      </div>
      <div class="ledger-credits">Credits: ${state.credits} · Packet seal: ${state.encryption.toUpperCase()}</div>
    </div>`;

  root.innerHTML = html;
  root.querySelector(".ledger-close")!.addEventListener("click", onClose);
  root.addEventListener(
    "click",
    (e) => {
      if (e.target === root) onClose();
    },
    { once: true },
  );
}
