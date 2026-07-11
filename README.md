# Passphrase

Passphrase is a voice-driven browser game. An ASCII road scrolls toward you and
each wall carries a word or phrase; say it correctly before the wall arrives and
a gate opens, hesitate or misspeak and you lose a life. It is built on the Web
Speech API and ships as a self-contained static site of plain ES modules — no
build step, no bundler, no dependencies.

The modular application at the repository root is now **canonical**. The earlier
standalone single-file prototypes have been archived under `OLD/` for reference;
all new work happens in the modular architecture described below.

## Running

Serve the repository root over a local static server (the Web Speech API needs a
secure context, so `file://` will not work):

```sh
python3 -m http.server 5173
```

Open:

```text
http://127.0.0.1:5173/
```

Chrome or Edge is required for `SpeechRecognition`. Microphone permission is
required for speech recognition, the ASCII waveform, echo capture, and generated
talk-back reference capture.

Run the dependency-free module tests (no browser required):

```sh
node tests/run-tests.mjs
```

The app is designed for static deployment, including GitHub Pages. The only
runtime network dependency is the optional configured TTS endpoint used by the
talk-back feature.

## Game content — `game-script.md`

All game content lives in a single markdown file at the repo root:
[`game-script.md`](game-script.md). It is the one place to edit levels, rounds,
and phrases — no code required — so non-coding contributors can update the game
for playtesting. It is fetched at startup.

Schema:

```text
# Level 1                     a level (the name shows on the intro card)
subtitle: BORDER CHECKPOINT   optional smaller line under the name
environment: border-fence     optional style preset (see below)

## Talkback                   optional: this level's random talk-back pool
How can I help you?           spoken at random moments during the level

## Round 1                    a round within the level
Albania                       a phrase to say
Exit
*hmmm*                        a wordless SOUND target (see below)
~ Sorry, this checkpoint...   a specific cue, played after "Exit" clears
Germany
```

A phrase wrapped in asterisks — `*hmmm*` — is a **sound target**: instead of matching the
transcript it is cleared when the player makes a **sustained vocalization** (mic level above a
threshold for a minimum time). Handy for warm-up sounds the speech recognizer can't catch. The
sensitivity is set by `VOCAL_THRESHOLD` / `VOCAL_MIN_MS` in `src/app/passphraseApp.js`.

- `subtitle:` and `environment:` must sit directly under the `# Level` line,
  before the first `## Round`. Lines starting with `>` are comments.
- `environment:` selects a built-in visual preset (defined in
  `src/content/environments.js`):
  - `border-fence` — fence walls, passport avatar, land background.
  - `undersea-cable` — firewall, key avatar, dark sea, memory-phrase swarm.
  An unknown value falls back to the default (`border-fence`) look.
- Add a level simply by adding another `# Level …` block; a dev jump button
  appears for it automatically.

Talk-back (the AI voice cloned from the player, spoken back over the game) is
also configured per level, so all content lives in one file:

- A `## Talkback` section lists **random** phrases played at random moments while
  that level runs.
- A `~ phrase` line inside a round is a **specific** cue: it is generated and
  played right after the player clears the phrase directly above it, for
  narrative timing.

Talk-back never interrupts the game loop — cues are generated and queued
asynchronously and only play if talk-back is enabled and the TTS endpoint is
ready. The endpoint URL, on/off, and random-frequency threshold remain in the
settings panel.

To run the local Qwen backend through an HTTPS tunnel for the deployed game,
follow the [Qwen TTS tunnel quick start](documentation/qwen-tts-tunnel-guide.md).

**Dev override.** The settings panel has a *game script* editor pre-filled from
`game-script.md`. Edits apply live and persist in `localStorage` for playtesting
across reloads; **[ reset to file ]** discards the override and reloads the
committed `game-script.md`.

## Repository structure

```text
.
├─ index.html              canonical app entry — loads src/main.js
├─ game-script.md          all game content: levels, rounds, phrases, styling
├─ styles/main.css         all styling and animations
├─ assets/audio/           looping music theme (ogg/mp3) + SFX (wav)
├─ src/                    the modular application
│  ├─ main.js              bootstrap: loads the script, calls initPassphraseApp()
│  ├─ app/                 coordinator + control/action event bindings
│  ├─ ui/                  DOM lookup, settings/config, view rendering
│  ├─ content/             game-script parsing, level catalog, style presets
│  ├─ matching/            transcript target matching
│  ├─ game/                pure sequence/lives rules and level activation
│  ├─ renderers/ascii/     ASCII road, scene, and player rendering
│  ├─ audio/               music/SFX + shared audio-buffer utilities
│  ├─ speech/              Web Speech API lifecycle
│  ├─ effects/             waveform, mic visualizer, Level 2 memory enemies
│  ├─ echo/                echo interference subsystem
│  ├─ talkback/            generated talk-back (TTS) subsystem
│  └─ README.md            per-file source inventory
├─ tests/run-tests.mjs     dependency-free module tests
├─ documentation/          architecture notes + a slide-deck tour of the codebase
│  └─ passphrase-architecture-deck.html
└─ OLD/                    archived standalone prototypes (reference only)
```

Two documents are worth reading before contributing: `src/README.md` gives a
per-file inventory of every module, and
`documentation/passphrase-architecture-deck.html` is a visual, slide-by-slide
tour of the whole architecture — open it in a browser.

## Architecture

`src/app/passphraseApp.js` is the coordinator. It owns cross-subsystem sequence
flow and calls into focused modules instead of embedding every browser service
directly.

Subsystem ownership:

- `src/ui/` owns DOM lookup, settings/config normalization, and view rendering
  for onboarding, HUD/status, word lists, transcripts, and game-over state.
- `src/content/` owns game-script parsing (`game-script.md`), the level catalog,
  the environment style presets, and the runtime script source (fetch + dev
  override).
- `src/matching/` owns transcript target matching.
- `src/game/` owns pure sequence/lives rule helpers, level activation helpers,
  and transcript-to-sequence consumption.
- `src/renderers/` owns ASCII renderer math, road-scene helpers, and
  player/passport/password-key rendering.
- `src/audio/` owns music/SFX, shared audio-buffer utilities, and reusable
  segment-recording primitives.
- `src/speech/` owns Web Speech API lifecycle wrapping.
- `src/effects/` owns non-gameplay visual runtimes such as waveform rendering,
  microphone visualization, and Level 2 memory phrase enemies.
- `src/echo/` owns echo policy, panel rendering, recorder/playback
  orchestration, and WebAudio echo bus helpers.
- `src/talkback/` owns talk-back API/reference/client helpers, panel rendering,
  capture/generation orchestration, health checks, and playback state.

`passphraseApp.js` should read like a table of contents for the game flow:
level activation, transcript events, timers, and subsystem lifecycle calls. When
a block starts owning its own DOM details, animation frame, browser service, or
pure calculation, prefer extracting it behind a small module API and pass state
in as plain data or narrow callbacks.

## Contributing

From now on, all development happens in the modular architecture under `src/`.
The prototypes in `OLD/` are frozen; treat them as historical reference for how
the game used to look and play, not as a base to build on.

- Prefer changing one subsystem directory at a time.
- Keep pure logic in focused modules and add tests in `tests/run-tests.mjs`.
- Keep browser orchestration in `src/app/passphraseApp.js`; do not make sibling
  runtime services import each other directly.
- If a feature needs state from another subsystem, pass it through the app
  coordinator or a small plain-object snapshot.
- Preserve end-user behavior unless a change is explicitly intended to alter it;
  the archived prototypes in `OLD/` capture how the game previously behaved.
- Keep module APIs boring and explicit. A renderer should receive refs and data;
  a runtime should expose `start`, `stop`, and focused update methods; pure
  helpers should stay testable without a browser.
- The game modules should stay browser-free. They may mutate plain state
  snapshots, but effects such as sounds, DOM updates, speech, echo, and
  talk-back should be triggered by the app coordinator.
