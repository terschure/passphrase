# Passphrase Modular

Static ES-module implementation of the Passphrase voice game.

This directory is intentionally self-contained. The root prototype files are
the behavioral reference, but new modular work should happen here.

Run from the repository root:

```sh
python3 -m http.server 5173
```

Open:

```text
http://127.0.0.1:5173/passphrase-modular/
```

Chrome or Edge is required for `SpeechRecognition`. Microphone permission is
required for speech recognition, the ASCII waveform, echo capture, and generated
talk-back reference capture.

Run dependency-free module tests:

```sh
node passphrase-modular/tests/run-tests.mjs
```

The app is designed for static deployment, including GitHub Pages. The only
runtime network dependency is the optional configured TTS endpoint used by the
talk-back feature.

## Architecture

`src/app/passphraseApp.js` is now the coordinator. It owns cross-subsystem
sequence flow and calls into focused modules instead of embedding every browser
service directly.

Subsystem ownership:

- `src/ui/` owns DOM lookup, settings/config normalization, and view rendering
  for onboarding, HUD/status, word lists, transcripts, and game-over state.
- `src/content/` owns level and phrase data plus target-plan parsing.
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

## Multi-Dev Guidance

- Prefer changing one subsystem directory at a time.
- Keep pure logic in focused modules and add tests in `tests/run-tests.mjs`.
- Keep browser orchestration in `src/app/passphraseApp.js`; do not make sibling
  runtime services import each other directly.
- If a feature needs state from another subsystem, pass it through the app
  coordinator or a small plain-object snapshot.
- Preserve end-user parity with the root `index.html` unless a change is
  explicitly intended to alter behavior.
- Keep module APIs boring and explicit. A renderer should receive refs and data;
  a runtime should expose `start`, `stop`, and focused update methods; pure
  helpers should stay testable without a browser.
- The game modules should stay browser-free. They may mutate plain state
  snapshots, but effects such as sounds, DOM updates, speech, echo, and
  talk-back should be triggered by the app coordinator.
