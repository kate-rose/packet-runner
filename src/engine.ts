import { GameState, saveGame } from "./state";
import { applyReveal, Reveal, OBSERVER_LABELS, FACT_LABELS, CellState } from "./ledger";
import { renderLedger } from "./ui/ledger-screen";

// ---------------------------------------------------------------------------
// Story step types + authoring DSL
// ---------------------------------------------------------------------------

export type EndingId = "released" | "detained" | "credits";

export type Step =
  | { t: "bg"; name: string }
  | { t: "music"; name: string }
  | { t: "stopMusic" }
  | { t: "show"; img: string; at: "left" | "right" | "center"; label?: string }
  | { t: "hide"; id: string }
  | { t: "hideAll" }
  | { t: "say"; who: string; text: string }
  | { t: "log"; text: string }
  | { t: "menu"; prompt: string; choices: Choice[] }
  | { t: "label"; name: string }
  | { t: "goto"; to: string }
  | { t: "gotoIf"; cond: (s: GameState) => boolean; to: string }
  | { t: "do"; run: (s: GameState) => void }
  | { t: "reveal"; reveals: Reveal[] }
  | { t: "widget"; name: string; title: string; caption: string }
  | { t: "hideWidget" }
  | { t: "ending"; id: EndingId };

export interface Choice {
  text: string;
  when?: (s: GameState) => boolean;
  run?: (s: GameState) => void;
  reveals?: Reveal[];
  to?: string;
}

// DSL helpers — keep story.ts readable.
export const bg = (name: string): Step => ({ t: "bg", name });
export const music = (name: string): Step => ({ t: "music", name });
export const stopMusic = (): Step => ({ t: "stopMusic" });
export const show = (img: string, at: "left" | "right" | "center" = "center", label?: string): Step => ({ t: "show", img, at, label });
export const hide = (id: string): Step => ({ t: "hide", id });
export const hideAll = (): Step => ({ t: "hideAll" });
export const say = (who: string, text: string): Step => ({ t: "say", who, text });
export const n = (text: string): Step => ({ t: "say", who: "", text }); // narration
export const log = (text: string): Step => ({ t: "log", text });
export const menu = (prompt: string, choices: Choice[]): Step => ({ t: "menu", prompt, choices });
export const label = (name: string): Step => ({ t: "label", name });
export const goto = (to: string): Step => ({ t: "goto", to });
export const gotoIf = (cond: (s: GameState) => boolean, to: string): Step => ({ t: "gotoIf", cond, to });
export const doo = (run: (s: GameState) => void): Step => ({ t: "do", run });
export const reveal = (...reveals: Reveal[]): Step => ({ t: "reveal", reveals });
// A framed animated widget (SVG in public/widgets/) shown in tile-window chrome.
export const widget = (name: string, title: string, caption = ""): Step => ({ t: "widget", name, title, caption });
// Dismiss a persistent widget (widgets now stay up across dialogue until this,
// a menu, or a scene change).
export const hideWidget = (): Step => ({ t: "hideWidget" });
export const ending = (id: EndingId): Step => ({ t: "ending", id });

// ---------------------------------------------------------------------------
// Asset resolution — reuse the original art, fall back to labeled placeholders
// for the new-script locations/characters that don't have art yet.
// ---------------------------------------------------------------------------

const BASE = import.meta.env.BASE_URL;

const KNOWN_IMAGES = new Set([
  "divebarnodrink", "divebar", "docslab", "black", "docks", "networkharbor",
  "ISPStation", "ticketbooth", "archiveelevator", "librarydeskwlibrarian",
  "librarydeskempty", "backtodoc", "part1card", "breakingnews",
  "docchar", "router", "dennischar", "librarian",
  "packetarchive1", "packetarchive2", "packetdecrypting", "packetdoc",
  "packetencrypting", "packettracker", "tileblank", "tilecomplete", "tileloading",
  // new custom art (VPN scenes)
  "vpnstation", "vpnentrance",
  // character busts (cut out from the licensed pack)
  "cecilia", "eddie", "entrynode", "middlenode", "exitnode",
  "attendant", "vendor", "barista", "officer1", "officer2",
  // placeholder comic-style scene backgrounds (SVG, swap for real art later)
  "traininterior", "outsideuniv", "computerlab", "alley", "streetcorner",
  "coffeeshop", "street", "newsstand", "interrogation", "timessquare", "daystreet",
]);

const ALIASES: Record<string, string> = {
  ispstation: "ISPStation",
  librarydesk: "librarydeskwlibrarian",
  dennis: "dennischar",
};

// File extension per image (defaults to png). Add entries for jpg/webp/svg art.
const IMAGE_EXT: Record<string, string> = {
  vpnstation: "jpg",
  vpnentrance: "jpg",
  traininterior: "svg", outsideuniv: "svg", computerlab: "svg", alley: "svg",
  streetcorner: "svg", coffeeshop: "svg", street: "svg", newsstand: "svg",
  interrogation: "svg", timessquare: "svg", daystreet: "svg",
};

// Friendly labels for placeholder backgrounds (new-script locations w/o art).
const LOCATION_LABELS: Record<string, string> = {
  vpnentrance: "A discreet door · VPN entrance",
  vpnstation: "VPN Station",
  traininterior: "On the train",
  outsideuniv: "Outside the University",
  computerlab: "Lab 12G · Computer Science",
  alley: "A back alley",
  streetcorner: "Street corner",
  coffeeshop: "Coffee shop",
  street: "City street",
  newsstand: "Unwired Magazine · news stand",
  interrogation: "Interrogation room",
  timessquare: "The center square",
  daystreet: "Daytime street",
};

const SPRITE_LABELS: Record<string, string> = {
  cecilia: "Cecilia", eddie: "Eddie", attendant: "Station Attendant",
  entrynode: "Entry Node", middlenode: "Middle Node", exitnode: "Exit Node",
  officer1: "Authority Officer", officer2: "Authority Officer",
  vendor: "News Vendor", barista: "Barista",
};

function resolveImage(name: string): string | null {
  const actual = ALIASES[name] ?? name;
  if (KNOWN_IMAGES.has(actual)) return `${BASE}images/${actual}.${IMAGE_EXT[actual] ?? "png"}`;
  return null;
}

// Speaker name -> accent color (cassette-futurism palette).
const SPEAKER_COLORS: Record<string, string> = {
  You: "#ffd27f",
  Doc: "#f6b94b",
  Tile: "#7fd4ff",
  Bartender: "#d9b38c",
  Archivist: "#79e0c8",
  Router: "#8ab6d6",
  Dennis: "#9bdc7f",
  Cecilia: "#c79bff",
  Eddie: "#cfa6e0",
  "Station Attendant": "#7fd4ff",
  "Entry Node": "#79e0c8",
  "Middle Node": "#6fd0b8",
  "Exit Node": "#62c0a8",
  Barista: "#e0b07f",
  "News Vendor": "#d6b06a",
  Voice: "#9aa0a6",
  "Authority Officer": "#ff8a7a",
  "Other Authority Officer": "#ff7a6a",
  Newscaster: "#bcd0e0",
};

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

export class Engine {
  private program: Step[];
  private labels = new Map<string, number>();
  private pc = 0;
  state: GameState;

  private elBg = document.getElementById("bg")!;
  private elBgLabel = document.getElementById("bg-label")!;
  private elSprites = document.getElementById("sprites")!;
  private elOverlay = document.getElementById("overlay")!;
  private elTextbox = document.getElementById("textbox")!;
  private elSpeaker = document.getElementById("speaker")!;
  private elDialogue = document.getElementById("dialogue")!;
  private elMenu = document.getElementById("menu")!;
  private elToast = document.getElementById("toast")!;
  private elWidget = document.getElementById("widget")!;
  private elLedger = document.getElementById("ledger-screen")!;

  private audio: HTMLAudioElement | null = null;
  private currentTrack = "";
  private muted = false;
  private sprites = new Map<string, HTMLElement>();

  private typing = false;
  private typeTimer: number | null = null;
  private fullText = "";

  constructor(program: Step[], state: GameState, startPc = 0) {
    this.program = program;
    this.state = state;
    this.pc = startPc;
    program.forEach((s, i) => {
      if (s.t === "label") this.labels.set(s.name, i);
    });

    try {
      this.muted = localStorage.getItem("packet-runner-muted") === "1";
    } catch {
      this.muted = false;
    }
    this.updateAudioButton();

    this.elTextbox.addEventListener("click", () => this.onAdvance());
    this.elWidget.addEventListener("click", () => this.onAdvance());
    document.getElementById("ledger-btn")!.addEventListener("click", () => this.toggleLedger());
    document.getElementById("audio-btn")!.addEventListener("click", () => this.toggleMute());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        if (!this.elMenu.classList.contains("hidden")) return;
        e.preventDefault();
        this.onAdvance();
      } else if (e.key === "Escape") {
        this.toggleLedger();
      }
    });
  }

  start(): void {
    this.run();
  }

  // Dev-only: jump straight to a label and resume. Exposed on window for
  // scene/art QA (see main.ts). Harmless in production — just unused.
  debugJump(name: string): void {
    this.clearSprites();
    this.elMenu.classList.add("hidden");
    this.jump(name);
    this.run();
  }

  private jump(name: string): void {
    const idx = this.labels.get(name);
    if (idx === undefined) {
      console.error(`Unknown label: ${name}`);
      return;
    }
    this.pc = idx;
  }

  // Execute instant steps until we hit one that waits for the player.
  private run(): void {
    while (this.pc < this.program.length) {
      const step = this.program[this.pc];
      this.pc++;
      switch (step.t) {
        case "bg":
          this.setBg(step.name);
          break;
        case "music":
          this.playMusic(step.name);
          break;
        case "stopMusic":
          this.stopMusic();
          break;
        case "show":
          this.showSprite(step.img, step.at, step.label);
          break;
        case "hide":
          this.hideSprite(step.id);
          break;
        case "hideAll":
          this.clearSprites();
          break;
        case "label":
          break;
        case "goto":
          this.jump(step.to);
          break;
        case "gotoIf":
          if (step.cond(this.state)) this.jump(step.to);
          break;
        case "do":
          step.run(this.state);
          break;
        case "reveal":
          this.applyReveals(step.reveals);
          break;
        case "widget":
          this.renderWidget(step.name, step.title, step.caption);
          this.persist();
          return;
        case "hideWidget":
          this.clearWidget();
          break;
        case "say":
          this.renderSay(step.who, step.text);
          this.persist();
          return;
        case "log":
          this.renderLog(step.text);
          this.persist();
          return;
        case "menu":
          this.renderMenu(step.prompt, step.choices);
          return;
        case "ending":
          this.renderEnding(step.id);
          return;
      }
    }
  }

  private persist(): void {
    saveGame(this.state, this.pc);
  }

  private onAdvance(): void {
    if (!this.elMenu.classList.contains("hidden")) return;
    if (this.typing) {
      this.finishTyping();
      return;
    }
    if (this.elTextbox.classList.contains("hidden")) return;
    this.run();
  }

  // ---- rendering ----

  private setBg(name: string): void {
    const url = resolveImage(name);
    if (url) {
      this.elBg.style.backgroundImage = `url("${url}")`;
      this.elBg.className = "";
      this.elBgLabel.textContent = "";
      this.elBgLabel.classList.add("hidden");
    } else {
      this.elBg.style.backgroundImage = "none";
      this.elBg.className = "placeholder-bg";
      const lbl = LOCATION_LABELS[name] ?? name.toUpperCase();
      this.elBgLabel.textContent = lbl;
      this.elBgLabel.classList.remove("hidden");
    }
    // Changing scene clears character sprites (Ren'Py "scene" semantics).
    this.clearSprites();
    this.clearWidget();
  }

  private showSprite(img: string, at: "left" | "right" | "center", label?: string): void {
    const url = resolveImage(img);
    const container = at === "center" ? this.elOverlay : this.elSprites;
    // Center overlays (packets/tiles) replace each other; named characters stack.
    const id = at === "center" ? `overlay-${img}` : `sprite-${img}`;
    this.hideSprite(img);
    let el: HTMLElement;
    if (url) {
      const im = document.createElement("img");
      im.src = url;
      im.className = `sprite at-${at}`;
      el = im;
    } else {
      el = document.createElement("div");
      el.className = `sprite placeholder-sprite at-${at}`;
      el.textContent = label ?? SPRITE_LABELS[img] ?? img;
    }
    el.dataset.key = img;
    container.appendChild(el);
    this.sprites.set(id, el);
    this.updateCrowd();
  }

  // Shrink busts when two characters share the screen (left + right).
  private updateCrowd(): void {
    this.elSprites.classList.toggle("crowd", this.elSprites.childElementCount > 1);
  }

  private hideSprite(img: string): void {
    for (const key of [`overlay-${img}`, `sprite-${img}`]) {
      const el = this.sprites.get(key);
      if (el) {
        el.remove();
        this.sprites.delete(key);
      }
    }
    this.updateCrowd();
  }

  private clearSprites(): void {
    this.elSprites.innerHTML = "";
    this.elOverlay.innerHTML = "";
    this.sprites.clear();
    this.updateCrowd();
  }

  private clearWidget(): void {
    this.elWidget.classList.add("hidden");
    this.elWidget.innerHTML = "";
  }

  // A framed, self-animating SVG widget shown in tile-window chrome.
  private renderWidget(name: string, title: string, caption: string): void {
    this.elWidget.innerHTML =
      `<div class="widget-window">` +
      `<div class="prompt-titlebar">` +
      `<span class="prompt-dots"><i></i><i></i><i></i></span>` +
      `<span class="prompt-title">${title}</span></div>` +
      `<div class="widget-body"></div></div>`;
    this.elWidget.classList.remove("hidden");
    const body = this.elWidget.querySelector(".widget-body")!;
    // inject the SVG inline so its SMIL/CSS animations run
    fetch(`${BASE}widgets/${name}.svg`)
      .then((r) => r.text())
      .then((svg) => { body.innerHTML = svg; })
      .catch(() => { body.textContent = "[widget unavailable]"; });
    // caption + continue hint reuse the normal textbox (don't clear the widget)
    this.setText("", caption);
  }

  private setText(who: string, text: string): void {
    this.elMenu.classList.add("hidden");
    this.elTextbox.classList.remove("hidden");
    this.elTextbox.classList.toggle("narration", who === "");
    this.elSpeaker.textContent = who;
    this.elSpeaker.style.color = SPEAKER_COLORS[who] ?? "#ffd27f";
    this.elSpeaker.style.display = who ? "block" : "none";
    this.typewrite(text);
  }

  private renderSay(who: string, text: string): void {
    this.setText(who, text);
  }

  private renderLog(text: string): void {
    this.elMenu.classList.add("hidden");
    this.elTextbox.classList.remove("hidden");
    this.elTextbox.classList.remove("narration");
    this.elSpeaker.textContent = "● LOG CREATED";
    this.elSpeaker.style.color = "#ff8a7a";
    this.elSpeaker.style.display = "block";
    this.pulseTile();
    this.typewrite(text);
  }

  private typewrite(text: string): void {
    this.fullText = text;
    this.elDialogue.textContent = "";
    this.typing = true;
    let i = 0;
    const hint = document.getElementById("continue-hint")!;
    hint.style.opacity = "0";
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.typeTimer = window.setInterval(() => {
      i += 1;
      this.elDialogue.textContent = text.slice(0, i);
      if (i >= text.length) this.finishTyping();
    }, 16);
  }

  private finishTyping(): void {
    if (this.typeTimer) {
      clearInterval(this.typeTimer);
      this.typeTimer = null;
    }
    this.elDialogue.textContent = this.fullText;
    this.typing = false;
    document.getElementById("continue-hint")!.style.opacity = "0.7";
  }

  private renderMenu(prompt: string, choices: Choice[]): void {
    this.clearWidget();
    this.elMenu.innerHTML = "";
    if (prompt) {
      const win = document.createElement("div");
      win.className = "prompt-window";
      win.innerHTML =
        `<div class="prompt-titlebar">` +
        `<span class="prompt-dots"><i></i><i></i><i></i></span>` +
        `<span class="prompt-title">▦ tile</span></div>` +
        `<div class="prompt-body"></div>`;
      win.querySelector(".prompt-body")!.textContent = prompt;
      this.elMenu.appendChild(win);
    }
    for (const c of choices) {
      if (c.when && !c.when(this.state)) continue;
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = c.text;
      btn.addEventListener("click", () => {
        if (c.run) c.run(this.state);
        if (c.reveals) this.applyReveals(c.reveals);
        this.elMenu.classList.add("hidden");
        if (c.to) this.jump(c.to);
        this.run();
      });
      this.elMenu.appendChild(btn);
    }
    this.elMenu.classList.remove("hidden");
    this.elTextbox.classList.add("hidden");
  }

  private renderEnding(id: EndingId): void {
    this.elTextbox.classList.add("hidden");
    this.elMenu.classList.add("hidden");
    saveGame(this.state, this.program.length); // mark complete
    renderLedger(this.elLedger, this.state, () => this.toggleLedger());
    // The ending screens themselves are authored as normal steps; this hook is
    // reserved for future special-casing. For now, just continue.
    void id;
    this.run();
  }

  // ---- ledger ----

  private applyReveals(reveals: Reveal[]): void {
    for (const r of reveals) {
      const changed = applyReveal(this.state.ledger, r);
      if (changed) this.toastReveal(r.who, r.fact, r.state);
    }
  }

  private toastReveal(who: keyof typeof OBSERVER_LABELS, fact: keyof typeof FACT_LABELS, state: CellState): void {
    const verb =
      state === "logged" ? "logged"
      : state === "warrant" ? "holds (warrant only)"
      : state === "split" ? "got a fragment of"
      : "now knows";
    const t = document.createElement("div");
    t.className = `toast-item state-${state}`;
    t.innerHTML = `<span class="toast-who">${OBSERVER_LABELS[who]}</span> ${verb} <span class="toast-fact">${FACT_LABELS[fact].toLowerCase()}</span>`;
    this.elToast.appendChild(t);
    this.pulseTile();
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 400);
    }, 2600);
  }

  private pulseTile(): void {
    const btn = document.getElementById("ledger-btn")!;
    btn.classList.remove("pulse");
    void btn.offsetWidth; // restart animation
    btn.classList.add("pulse");
  }

  private toggleLedger(): void {
    if (this.elLedger.classList.contains("hidden")) {
      renderLedger(this.elLedger, this.state, () => this.toggleLedger());
      this.elLedger.classList.remove("hidden");
    } else {
      this.elLedger.classList.add("hidden");
    }
  }

  // ---- audio ----

  private playMusic(name: string): void {
    if (this.currentTrack === name) return;
    this.currentTrack = name;
    if (this.audio) this.audio.pause();
    const url = `${BASE}audio/${name}.mp3`;
    this.audio = new Audio(url);
    this.audio.loop = true;
    this.audio.volume = 0.4;
    this.audio.muted = this.muted;
    this.audio.play().catch(() => {
      /* autoplay may be blocked until first interaction — that's fine */
    });
  }

  private stopMusic(): void {
    if (this.audio) this.audio.pause();
    this.currentTrack = "";
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    if (this.audio) this.audio.muted = this.muted;
    try {
      localStorage.setItem("packet-runner-muted", this.muted ? "1" : "0");
    } catch {
      /* storage may be unavailable — ignore */
    }
    this.updateAudioButton();
  }

  private updateAudioButton(): void {
    const btn = document.getElementById("audio-btn");
    if (btn) btn.classList.toggle("muted", this.muted);
  }
}
