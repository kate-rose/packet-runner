# Packet Runner (web rebuild)

A privacy-education visual novel by **Kate Bertash**. Part 1.

This is a from-scratch, Ren'Py-free rebuild: a small data-driven VN engine in
vanilla TypeScript + Vite. The full Part 1 script is ported in, and the old
hidden `trace_meter` score is replaced by the **"Who Knows What" ledger** — a
visible grid of which network observer learned which fact about your job. The
interrogation reads that ledger instead of a score. (See `MECHANIC_REDESIGN.md`.)

## Run it

```bash
npm install
npm run dev      # play at http://localhost:5181
npm run build    # produces dist/ — a static, itch-ready folder
```

## Upload to itch.io

1. `npm run build`
2. Zip the **contents** of `dist/` (so `index.html` is at the zip root).
3. On itch: new project → Kind = HTML → upload the zip → check
   "This file will be played in the browser" → set viewport ~960×600 (or
   fullscreen). The build uses relative asset paths, so it runs from itch's
   subfolder with no config.

## How it's built

| File | Role |
|---|---|
| `src/story/story.ts` | The entire Part 1 script, authored in a small DSL |
| `src/engine.ts` | VN runtime: scenes, sprites, menus, typewriter, audio, the DSL helpers, asset resolution |
| `src/ledger.ts` | The "Who Knows What" model + the interrogation's `anyoneHasFullPicture()` check |
| `src/ui/ledger-screen.ts` | The tile/ledger overlay |
| `src/state.ts` | Game state + localStorage save/load |
| `src/style.css` | Cassette-futurism styling (amber on warm black, scanlines) |
| `public/images`, `public/audio` | Art + music recovered from the original Ren'Py build |

### Authoring the story

The script is a flat array of steps with labels + gotos (mirrors how the
original Ren'Py script was structured, so porting was mechanical):

```ts
say("Doc", `Very special, this one.`),
menu(`What do you do?`, [
  { text: "Ask for end-to-end encryption", to: "enc_e2e" },
]),
reveal({ who: "isp", fact: "destination", state: "logged" }),
gotoIf((s) => s.usedSms, "sms_flashback"),
```

`reveal(...)` is how a beat writes to the ledger. `gotoIf`/`goto`/`label`
handle branching. `do(fn)` mutates state (credits, flags, encryption level).

## Still placeholder

The second half of Part 1 (VPN station, university, Tor alley, coffee shop,
SecureDrop, interrogation room, the news square) plays fully, but those
locations and the new characters (Cecilia, Eddie, the Tor nodes, the officers,
the attendant, the vendor, the barista) render as labeled placeholders until
art is made. Backgrounds and character art drop in by adding PNGs to
`public/images/` and registering the filename in `KNOWN_IMAGES` in `engine.ts`.
