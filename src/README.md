# Source Layout

`main.js` starts the app by calling `app/passphraseApp.js`.

`app/passphraseApp.js` is the coordinator. It still contains the cross-system
gameplay flow, but it now consumes focused modules for DOM/config, content,
matching, music, speech, effects, renderer helpers, echo/talk-back panels, and
shared audio-buffer logic.

- `app/actionBindings.js` owns start/stop/clear, onboarding, and dev shortcut
  event registration.
- `app/controlBindings.js` owns settings/control event registration and calls
  explicit app callbacks.
- `content/targetPlan.js` parses the `game-script.md` markdown into structured
  levels (title, subtitle, environment, rounds, per-level talk-back pool, and
  positional talk-back cues) plus a flat entry list (`parseGameScript`;
  `parseTargetPlan` is the flat-entry back-compat wrapper).
- `content/levelCatalog.js` is a thin query layer over the parsed script,
  re-reading it on each call so edits (including the dev override) take effect
  immediately.
- `content/environments.js` defines the built-in visual style presets
  (`border-fence`, `undersea-cable`) a level selects via `environment:`.
- `game/vocalization.js` is a pure detector that fires when the live mic
  amplitude stays above a threshold for a minimum time — used to clear
  `*sound*` (wordless) targets from the script without a transcript match.
- `content/gameScriptSource.js` (browser-only) loads the canonical
  `game-script.md`, applies/persists the dev override in `localStorage`, and
  supports reset-to-file.
- `matching/matching.js` implements target normalization and fuzzy matching.
- `game/rules.js` captures core sequence/lives progression rules.
- `game/catchMode.js` owns catch-mode text consumption against target words.
- `game/levelProgression.js` captures level activation, next-level selection,
  and keygen distortion helpers.
- `game/levelProgressionEffects.js` owns Level 2 completion counts and the
  keygen/memory-enemy side-effect policy for level progression.
- `game/sequenceText.js` consumes transcript text against the current sequence
  and returns pure progression results for the app to decorate with effects.
- `audio/bufferUtils.js` contains shared audio-buffer utilities.
- `audio/musicManager.js` owns music playback, lightweight EQ, SFX, and ducking.
- `audio/segmentRecorder.js` owns reusable MediaRecorder segment capture
  setup, stop, and discard behavior.
- `speech/speechService.js` wraps the Web Speech API.
- `speech/recognitionFlow.js` owns recognition result processing and Web
  Speech lifecycle callback wiring.
- `speech/recognitionResults.js` owns collection of final and live transcript
  text from Web Speech result events.
- `speech/transcriptState.js` owns final/interim transcript storage and
  clear-during-recognition bookkeeping.
- `ui/domRefs.js` owns DOM lookup and settings normalization.
- `ui/onboarding.js`, `ui/levelIntro.js`, `ui/hud.js`, `ui/wordList.js`,
  `ui/transcript.js`, and `ui/gameOver.js` own user-facing render helpers and
  small UI controllers.
- `effects/asciiWaveform.js` owns waveform and game-over fire updates.
- `effects/microphoneVisualizer.js` owns microphone stream, analyser, and idle
  visualizer animation lifecycle.
- `effects/memoryPhraseEnemies.js` owns the Level 2 floating memory phrase
  runtime.
- `renderers/ascii/hash.js` owns renderer math helpers.
- `renderers/ascii/keygenCharacter.js` owns passport/password-key visual state,
  signal timing, respawn/failure states, and distortion snapshots.
- `renderers/ascii/roadAnimation.js` owns the throttled timeline animation loop.
- `renderers/ascii/roadScene.js` owns road props, wall/fence/firewall pattern
  helpers, and obstacle class mapping.
- `renderers/ascii/timelineState.js` owns timer/timeline/road render-state
  calculation before DOM rendering.
- `renderers/ascii/roadRenderer.js` owns road row construction and timeline DOM
  fragment rendering.
- `renderers/ascii/player.js` owns passport/password-key art, bounds, and
  character class mapping.
- `echo/policy.js` owns echo mode/rate/snippet policy.
- `echo/defaultConfig.js` owns echo runtime defaults and preferred MIME
  selection.
- `echo/panel.js` owns echo panel rendering.
- `echo/fxBus.js` owns delay/reverb WebAudio bus construction and gain updates.
- `echo/runtime.js` owns echo segment capture, snippet storage, cooldowns,
  playback orchestration, and panel refreshes.
- `talkback/reference.js` owns talk-back URL/fetch/reference helpers.
- `talkback/endpoint.js` selects local or deployed talk-back API defaults from
  the page origin.
- `talkback/cache.js` owns the bounded generated-audio URL cache.
- `talkback/defaultConfig.js` owns talk-back runtime defaults.
- `talkback/panel.js` owns talk-back panel rendering.
- `talkback/client.js` owns talk-back reference upload, generation request, and
  playback URL helpers.
- `talkback/runtime.js` owns talk-back capture, segment storage, health checks,
  reference upload cache, generation queue, playback state, and panel refreshes.

Dependency direction:

- Pure modules should not import `app/passphraseApp.js`.
- Runtime modules should receive browser APIs, DOM refs, or state snapshots as
  arguments instead of reaching across sibling subsystems.
- `app/passphraseApp.js` is the only place that should coordinate side effects
  across speech, renderer, audio, echo, talk-back, and UI.

Next extraction targets:

- Move the remaining debug/dev controls into an app-adjacent controller once
  the gameplay coordinator is smaller.
- Split speech recognition event wiring from transcript processing so Web
  Speech lifecycle and game text consumption can evolve independently.
- Move keyboard/button event binding into focused UI controllers that call the
  app coordinator through explicit methods.
