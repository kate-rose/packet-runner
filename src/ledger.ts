// The "Who Knows What" ledger — the heart of Packet Runner's redesign.
//
// Instead of a hidden "trace score" you minimize, the game tracks, for every
// observer in the network, which FACTS about your job they learned. Privacy here
// is not invisibility — it's compartmentalization: making sure no single observer
// ever holds the whole picture. The interrogation reads this grid directly.

export type Observer =
  | "tile" // your tile / TILECORP — logs that you were somewhere, never why
  | "carrier" // your phone carrier — only if you send unencrypted SMS
  | "router" // gets you out of the 8080 block
  | "isp" // Dennis / DNS — resolves and logs destinations
  | "vpn" // virtual private network
  | "tor" // the onion router — special: this row is SPLIT across nodes
  | "archive" // holds the search record; releasable only by warrant
  | "cameras"; // the passive facial-recognition dragnet (the Eyes)

export type Fact =
  | "identity" // who you are / where you came from
  | "destination" // where this packet is going
  | "contents" // what is inside the packet
  | "association"; // the link between you and Doc / the recipients

export type CellState =
  | "unknown" // — they never learned it
  | "seen" // they know it right now
  | "logged" // they know it AND keep a record (the dangerous state)
  | "warrant" // they hold a record, but only release it with legal process
  | "split"; // (Tor) a useless fragment without the other nodes

export const OBSERVERS: Observer[] = [
  "tile",
  "carrier",
  "router",
  "isp",
  "vpn",
  "tor",
  "archive",
  "cameras",
];

export const FACTS: Fact[] = ["identity", "destination", "contents", "association"];

export const OBSERVER_LABELS: Record<Observer, string> = {
  tile: "Your Tile / TILECORP",
  carrier: "Phone Carrier",
  router: "The Router",
  isp: "ISP (Dennis / DNS)",
  vpn: "VPN",
  tor: "Tor Network",
  archive: "The Archive",
  cameras: "The Cameras (Eyes)",
};

export const FACT_LABELS: Record<Fact, string> = {
  identity: "Who you are",
  destination: "Where you're going",
  contents: "What's in the packet",
  association: "Your link to Doc",
};

export type Ledger = Record<Observer, Record<Fact, CellState>>;

export function newLedger(): Ledger {
  const l = {} as Ledger;
  for (const o of OBSERVERS) {
    l[o] = { identity: "unknown", destination: "unknown", contents: "unknown", association: "unknown" };
  }
  return l;
}

// Rank so a reveal never silently downgrades something already worse.
const RANK: Record<CellState, number> = {
  unknown: 0,
  split: 1,
  warrant: 2,
  seen: 3,
  logged: 4,
};

export interface Reveal {
  who: Observer;
  fact: Fact;
  state: CellState;
}

export function applyReveal(ledger: Ledger, r: Reveal): boolean {
  const current = ledger[r.who][r.fact];
  // "warrant" is a protective state — don't let it be re-marked as plain "seen".
  if (current === "warrant" && (r.state === "seen" || r.state === "split")) return false;
  if (RANK[r.state] <= RANK[current]) return false;
  ledger[r.who][r.fact] = r.state;
  return true;
}

// A fact is "freely usable" by an observer if they can just hand it over.
// Warrant-protected and split fragments do NOT count — that's the whole point.
function freelyKnows(state: CellState): boolean {
  return state === "seen" || state === "logged";
}

// Does ANY single observer hold the complete picture (all four facts) in a
// freely-usable form? Tor is excluded — it is split by construction and no
// single node can ever hold both ends.
export function anyoneHasFullPicture(ledger: Ledger): boolean {
  for (const o of OBSERVERS) {
    if (o === "tor") continue;
    const row = ledger[o];
    if (FACTS.every((f) => freelyKnows(row[f]))) return true;
  }
  return false;
}

// Helper for the interrogation script: which freely-usable facts does an
// observer hold? Used to make the officers cite real fragments.
export function freelyHeldFacts(ledger: Ledger, o: Observer): Fact[] {
  return FACTS.filter((f) => freelyKnows(ledger[o][f]));
}
