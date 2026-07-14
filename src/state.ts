import { Ledger, newLedger } from "./ledger";

export type EncryptionLevel = "ssl" | "tls" | "e2e";

export interface GameState {
  ledger: Ledger;
  credits: number;
  encryption: EncryptionLevel; // how Doc's packet is sealed
  usedSms: boolean; // sent Doc an unencrypted SMS
  smsTranscript: string;
  usedTor: boolean; // travelled the final leg via Tor
  flags: Record<string, boolean>;
}

export function newGameState(): GameState {
  return {
    ledger: newLedger(),
    credits: 400,
    encryption: "ssl",
    usedSms: false,
    smsTranscript: "",
    usedTor: false,
    flags: {},
  };
}

const SAVE_KEY = "packet-runner-save-v2";

export function saveGame(state: GameState, pc: number): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state, pc }));
  } catch {
    /* storage may be unavailable in some itch sandboxes — fail quietly */
  }
}

export function loadGame(): { state: GameState; pc: number } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
