# Packet Runner — Mechanic Redesign: The "Who Knows What" Ledger

**Status:** Implemented in this web rebuild (replaces `trace_meter`).
**Built around:** the full Part 1 narrative (Kate's new script).

---

## 1. Why the change

The old Ren'Py build tracked a hidden `trace_meter` (0–100) and gated three
endings on it. That mechanic taught the wrong lesson and fought the story.

| `trace_meter` implies… | …but the story actually teaches |
|---|---|
| Privacy = keep your score low, stay invisible | Privacy = **compartmentalization**: no single observer holds the whole picture |
| Getting "seen" = losing | You can be seen by *everyone* and still be safe if no one sees *everything* |
| Curiosity is punished | Every tool teaches something; experimenting should be safe |
| One optimal build wins | The **right to refuse** is the real backstop |

In the interrogation, the player has visibly used the ISP, a VPN, and Tor — a
maxed "trace" — and still walks free. Not because a number was low, but because
the Archive needs a warrant, the VPN kept no destination logs, Tor's entry node
structurally can't know the destination, and the player declines to talk.

---

## 2. The mechanic (as implemented)

A visible grid on the tile: for every **observer** (rows) × **fact** (columns),
what did they learn?

- **Observers:** Your Tile/TILECORP · Phone Carrier · The Router · ISP (Dennis) ·
  VPN · Tor (split across nodes) · The Archive · The Cameras (Eyes)
- **Facts:** Who you are · Where you're going · What's in the packet · Your link to Doc
- **Cell states:** unknown · `seen` · `logged` (knows + retains) · `warrant`
  (held but warrant-only) · `split` (Tor fragment, useless alone)

Code: `src/ledger.ts`. Each beat writes cells via `reveal(...)` in
`src/story/story.ts`. A toast + tile pulse fires whenever a cell changes — this
replaces the old "LOG CREATED" beat as the teaching device.

## 3. Choice → ledger mapping (live in the script)

| Beat | Choice | Ledger effect |
|---|---|---|
| Bar → reply to Doc | SMS (unencrypted) | Carrier: link-to-Doc = `logged` |
| Doc's lab | E2E / TLS | packet contents stay protected (Archive holds under `warrant`) |
| | Basic SSL | contents also `seen` by the ISP in transit |
| Router | tell him | Router: destination = `logged` |
| ISP / Dennis | give destination | ISP: destination = `logged`; tile logs presence |
| VPN station | (Doc's paid pass) | VPN: destination = `seen`, **never logged** |
| Tor handshake | entry/middle/exit | Tor: identity + destination = `split` |
| Cameras | (passive) | evaded while on Tor's hops (helmet down) |
| Archive | (recipient) | contents/association/destination = `warrant` |

## 4. The interrogation reads the ledger

```ts
if (anyoneHasFullPicture(ledger)) -> Detained
else -> the officers assemble only fragments -> you refuse -> Released
```

`anyoneHasFullPicture` returns true only if some single non-Tor observer holds
all four facts in a *freely usable* form (`seen`/`logged` — `warrant` and
`split` don't count). In a faithful Tor + E2E playthrough no one does, so the
canonical ending is **Released** — even though you were seen all over the
network. The SMS flashback still fires if you used unencrypted comms: the one
self-inflicted wound, raising tension without auto-losing.

## 5. What changed vs. the old build

- **Removed:** `trace_meter`, score-gated endings, the free-vs-premium VPN
  credit-sink-as-win-condition, the menu-guess "steganography minigame" (it's
  now Doc demonstrating LSB extraction, as in the script).
- **Kept:** the SSL/TLS/E2E choice at Doc's (good pedagogy → drives the contents
  column), credits as flavor, the SMS flashback.
