# HTML Monolith Subsystems Report

Analysis date: 2026-07-08

Scope:

- `index.html` - current working application, 7,211 lines.
- `index-2026-06-19.html` - June snapshot, 7,196 lines.
- `fuzzy_match.html` - older fuzzy-match prototype, 5,320 lines.

This report documents the subsystems present in the three standalone HTML files and frames them for a future refactor into a modular, extensible codebase. The analysis treats `index.html` as the current source of truth, `index-2026-06-19.html` as a near-current snapshot, and `fuzzy_match.html` as an earlier prototype that still contains behavior worth preserving or consciously dropping.

## Executive Summary

The application is currently a browser-only, single-file voice game. Each file contains all HTML, CSS, content data, state, rendering, speech recognition, microphone capture, music, sound effects, echo effects, generated TTS "talk-back", and UI wiring in one global script block.

There is only one formal JavaScript module-like boundary: `AudioManager`, implemented as an IIFE. Every other subsystem is a cluster of globals and functions that communicate by reading and writing shared top-level variables.

Main current subsystems:

- Shell and screen flow: onboarding, instructions, game-over, settings, dev controls.
- Input: Web Speech API recognition and keyboard/dev shortcuts.
- Transcript processing: exact matching, phrase fuzzy matching, selected transcript source, continue phrase handling.
- Game progression: current level, word index, timers, lives, retries, completion, failure, transition.
- Level content: Level 1 from the settings textarea, Level 2 hard-coded rounds.
- ASCII renderer: responsive road metrics, obstacle drawing, undersea environment, player/key object, fire/fence/firewall rendering.
- Visual effects: ASCII microphone waveform, game-over waveform/fire, Level 2 memory/enemy phrase layer.
- Audio: main theme, degradation pipeline, sound effects, microphone capture.
- Echo: records player snippets, trims them, renders wave previews, plays altered echoes through delay/reverb.
- Talk-back TTS: records reference audio, uploads reference, queues prompts, fetches generated audio from local API.

The code is functional but tightly coupled. The highest-value refactor is to split pure rules and data from browser side effects first: matching, level content, game state transitions, and renderer model generation. Audio, speech, and DOM can then be wrapped behind lifecycle-managed services.

## File Lineage And Differences

### `index.html`

`index.html` is the fullest and most current version. It includes:

- Pexico font loading.
- Full-screen hidden/control-minimal UI.
- Top score and lives HUD.
- Level intro overlay.
- Dev level controls.
- Level 2 undersea environment.
- Level 2 memory phrase/enemy layer.
- ASCII waveform background and game-over visualizer.
- Keygen/passport/password-key player object.
- Audio degradation that increases in Level 2.
- Exact matching plus multi-word fuzzy matching.
- Spoken normalization for symbols like `*` and dotted terms.
- Echo and talk-back systems.

### `index-2026-06-19.html`

This file is nearly the same architecture and feature set as `index.html`. The diff is mostly formatting and content drift. Important differences observed:

- `index.html` has updated talk-back phrase defaults and a larger `#words` textarea content block.
- Most JavaScript differences are formatting-only line wrapping.
- The Level 2 systems, `currentWordIndex`, keygen character, ASCII waveform, memory phrase layer, and dev controls already exist in the June snapshot.

Treat this as a historical snapshot, not a simpler architecture. It does not provide a meaningfully cleaner decomposition.

### `fuzzy_match.html`

This is an older prototype with a different emphasis:

- Uses `sequenceIndex` rather than `currentWordIndex`.
- Has visible canvas visualizers (`#visualizer`, canvas game-over visualizer).
- Contains stronger fuzzy/partial matching for single-word targets:
  - `collectTranscriptMatches`
  - `rangesOverlap`
  - `characterEditDistance`
  - `wordSimilarity`
  - `getPartialWordThreshold`
  - `findPartialTargetMatch`
- Uses default talk-back endpoint selection:
  - local endpoint for normal use.
  - tunnel endpoint for a GitHub Pages deployment.
- Does not contain the current Level 2 environment, memory phrase system, score HUD, keygen/passport/password-key player model, or ASCII waveform background.

The fuzzy prototype contains matching behavior that is not fully present in current `index.html`. If partial single-word recognition is valuable, preserve it before deleting this file.

## Monolith Structure

All three files follow the same broad structure:

1. Document head and embedded CSS.
2. Body markup for the game shell, overlays, panels, and settings.
3. One large inline `<script>` block.
4. Top-level DOM query cache.
5. Top-level constants and mutable state.
6. Function clusters.
7. Event listener registration.
8. Bootstrapping code.

Approximate current `index.html` structure:

| Area | Lines | Responsibility |
| --- | ---: | --- |
| CSS | 7-1300 | Visual design, responsive layout, overlays, ASCII styling, environment variants |
| Body markup | 1302-1646 | Onboarding, HUD, timeline, side panels, game over, settings and content textarea |
| DOM/state setup | 1647-1937 | Element references, constants, levels, global mutable runtime state |
| `AudioManager` | 1938-2426 | Music, SFX, Web Audio degradation, ducking |
| App/game/UI functions | 2427-3880 | settings, onboarding, levels, player state, matching, sequence lifecycle |
| ASCII world renderer | 3881-4914 | road metrics, scenery, obstacles, player rendering, timeline rendering |
| Visual/memory systems | 4915-5351 | waveform, game-over fire, Level 2 memory phrase layer, microphone visualizer |
| Talk-back and echo | 5352-6669 | MediaRecorder, audio processing, TTS API, echo bus, snippet playback |
| Events and boot | 6660-7211 | settings listeners, speech recognition handlers, dev controls, startup |

## Runtime Data Model

The code does not declare classes for domain data. It uses object literals and shared globals. The implicit models are:

| Model | Shape | Used by |
| --- | --- | --- |
| `LevelConfig` | `{ id, name, subtitle, environment, phrases/get phrases }` | `levels`, `getLevelConfig`, `setActiveLevel`, renderer |
| `TargetEntry` | `{ text, levelTitle, sequenceTitle, levelIndex, sequenceIndex }` | word list, status, matching, progression |
| `KeygenCharacter` | `{ state, stateUntil, signalUntil, distortionLevel }` | player drawing, voice signals, fail/respawn |
| Echo snippet | `{ id, label, buffer, peaks, state, rate? }` | echo panel, echo playback |
| Echo playback entry | `{ snippet, source, prerollTimer }` | active echo lifecycle |
| Talk-back segment | `{ blob, buffer, transcript, duration, createdAt }` | reference selection/upload |
| Talk-back ref | API returned object with at least `duration_s` and audio ref data | generation API |
| Memory phrase/enemy | `{ element, x, y, vx, vy, speed, scale, rotation, opacity, phase, glitchUntil, burstUntil, sideEntry }` | Level 2 enemy layer |

The central state variables in `index.html` are:

- Transcript: `finalChunks`, `interimTranscript`, `transcriptWasWiped`, `handlingRecognitionResult`, `transcriptWipedDuringResult`.
- Game progression: `currentLevel`, `currentWordIndex`, `totalWordsPerLevel`, `completedPhrasesFromLevel1`, `levelTransitionActive`, `sequenceFailed`, `failReason`.
- Beat/lives: `deadline`, `timerInterval`, `livesLeft`, `retriesLeft`, `wordCaughtThisBeat`, `gateOpenedAt`, `refillAnimationUntil`.
- Audio/input: `audioContext`, `analyser`, `micStream`, `visualizerFrame`, `idleVisualizerFrame`.
- Speech recognition: `activeRecognition`, `recognitionStarting`, `recognitionListening`, `onboardingVoiceBlocked`.
- Echo: `echoSnippets`, `activeEchoes`, `echoRecorder`, `echoBus`, `lastEchoAt`, `wallEchoFiredThisBeat`, `echoRandomInterval`.
- Talk-back: `talkbackSegments`, `talkbackQueue`, `talkbackRecorder`, `talkbackReady`, `talkbackRef`, `talkbackUploadPromise`, `talkbackGeneratePromise`, `talkbackAudio`, `talkbackSessionId`.
- Level 2: `memoryPhraseFrame`, `memoryPhraseLastFrame`, `memoryPhrases`, `memoryPhraseSource`, `level2CompletedWordCount`.

Refactor implication: the current data model should be made explicit before module extraction. A typed or documented state shape will reduce accidental dependencies.

## Subsystems

### 1. Application Shell And Screen Flow

Primary functions:

- `showOnboardingStep`
- `goToInstructions`
- `hideOnboarding`
- `startGame`
- `startGameFromOnboarding`
- `startGameFromVoice`
- `renderGameOverScreen`
- `continueFromGameOver`

The shell starts on an onboarding dialog. Step 1 shows the title and mood copy; step 2 explains the wall/word mechanic and starts passive voice recognition for "start". Starting the game hides onboarding, initializes the active level, starts music, requests microphone access, starts visualizers, starts echo/talk-back capture, and starts speech recognition if needed.

The game-over overlay is not a separate route. It is driven by `sequenceFailed` and `gameOverContinuing`. A failed sequence requires the configured continue phrase before restarting from the current word.

Couplings:

- Screen flow directly mutates gameplay state.
- Game start owns audio, microphone, speech, visualizer, echo, talk-back, level state, and DOM state.
- Game-over rendering reads sequence mode, target words, current word index, continue phrase, and waveform/fire effects.

Refactor target:

- `screens/onboarding`
- `screens/game-over`
- `app/startup`
- A small coordinator that calls services rather than owning all startup steps inline.

### 2. Settings And Configuration UI

Primary DOM:

- `#settings-panel`
- `#mode`
- `#seconds`
- `#lives`
- `#retries`
- `#transcript-source`
- `#sentence-fuzzy-match`
- `#continue-phrase`
- `#echo-mode`
- `#talkback-*`
- `#words`

Primary functions:

- `openSettings`
- `closeSettings`
- `getSecondsLimit`
- `getLivesLimit`
- `getRetriesLimit`
- `getContinuePhrase`
- `getSentenceFuzzyThreshold`
- `getTalkbackEndpoint`
- `getTalkbackThreshold`
- `getTalkbackPhrases`

Settings are both configuration and live runtime controls. Most listeners reset sequence state, reprocess transcripts, or restart timers. The `#words` textarea doubles as content storage and authoring UI.

Couplings:

- Game rules directly read DOM input values instead of a config object.
- Changes trigger immediate side effects.
- Content parsing depends on `wordsInput.value`.

Refactor target:

- `config/readConfigFromDom()` as a transitional adapter.
- Later, a `GameConfig` object owned by state.
- Content should move to JSON/JS data files, with textarea as optional editor/debug override.

### 3. Content And Level System

Primary functions:

- `parseTargetPlan`
- `getLevelConfig`
- `getLevelEntries`
- `getTargetEntries`
- `getTargetWords`
- `getCurrentTargetEntry`
- `setActiveLevel`
- `showLevelIntro`
- `beginActiveLevelGameplay`
- `transitionToNextLevel`
- `applyLevelEnvironment`

Current `index.html` has two levels:

- Level 1: "BORDER CHECKPOINT", environment `border-fence`, phrases derived from the first 18 entries in the `#words` textarea.
- Level 2: "UNDERSEA CABLE", environment `undersea-cable`, phrases hard-coded in `LEVEL_2_ROUNDS`.

`parseTargetPlan` interprets lines beginning with `#` as level headings and `##` as sequence headings. The current Level 2 textarea entries are present in the UI, but `getLevelEntries(2)` ignores the textarea and uses `LEVEL_2_ROUNDS` instead.

Couplings:

- Content is partly DOM-authored and partly hard-coded.
- Level configuration controls renderer theme, memory phrase system, music degradation, player drawing, target entries, and transition flow.
- `currentLevel` and `currentWordIndex` are global.

Refactor target:

- `content/levels.js` for level metadata and rounds.
- `content/parseTargetPlan.js` for editable text parsing.
- `game/levelController.js` for transitions.
- Make level environment an input to renderers rather than a global read.

### 4. Game State, Timer, Lives, And Progression

Primary functions:

- `resetSequence`
- `failSequence`
- `completeSequence`
- `handleDeadline`
- `startSequenceTimer`
- `stopSequenceTimer`
- `renderSequenceStatus`
- `processSequenceText`
- `catchWords`
- `rebuildCatchWordsFromSource`
- `isSequenceMode`
- `isBeatMode`

Modes:

- `catch`: no ordered sequence; any recognized target marks caught words.
- `sequence`: ordered progression advances immediately when the current target is found.
- `rhythm`: target must be spoken before the beat deadline; failure on missed beat.
- `lives`: beat-based mode where misses consume lives/retries and may advance after retries.

Important behavior:

- In beat modes, `wordCaughtThisBeat` opens the gate but `currentWordIndex` advances only when the deadline fires.
- In non-beat sequence mode, matching advances immediately in a loop.
- `handleDeadline` is also called by collision detection in `checkWallKeygenCollision`.
- Level completion attempts `transitionToNextLevel()` before final completion rendering.

Couplings:

- Timer logic renders DOM directly.
- State transitions trigger audio, talk-back, echo, player animation, score rendering, word list rendering, and level progression.
- `currentWordIndex` is overloaded as current target pointer and score/progress source.

Refactor target:

- Extract a pure reducer/state machine for sequence events:
  - `START_LEVEL`
  - `TRANSCRIPT_MATCHED`
  - `BEAT_EXPIRED`
  - `COLLISION`
  - `CONTINUE_ACCEPTED`
  - `RESET`
  - `COMPLETE_PHRASE_DEBUG`
- Side effects should subscribe to state transitions.

### 5. Speech Recognition And Transcript Pipeline

Primary browser dependency:

- `window.SpeechRecognition || window.webkitSpeechRecognition`

Primary functions:

- `startOnboardingVoiceRecognition`
- `normalizeVoiceCommand`
- `isStartCommand`
- `processTranscriptText`
- `renderTranscript`
- `renderTranscriptInto`
- `clearTranscript`
- `getSelectedTranscriptText`

The recognition instance is continuous and uses interim results. It has two phases:

- Before game start: listen for "start" on onboarding step 2.
- During game: process either final chunks or interim transcript depending on `#transcript-source`.

On every final result:

- Append to `finalChunks`.
- Cut echo and talk-back recording segments using the final text as label.
- Check for the onboarding start command if the game has not started.
- Process final text if final-only mode is selected.

On interim results:

- Build `interimTranscript`.
- Check for onboarding start command.
- Process interim text if interim mode is selected.

The wipe flags exist to handle a transcript reset while `recognition.onresult` is still iterating.

Couplings:

- Speech handlers directly trigger game state, visual signals, echo segmentation, talk-back segmentation, transcript render, and word list render.
- Web Speech API event shape is not abstracted.

Refactor target:

- `speech/SpeechRecognitionService` emits normalized events:
  - `started`
  - `stopped`
  - `error`
  - `finalTranscript`
  - `interimTranscript`
- `transcript/TranscriptStore` owns chunks and wipe behavior.

### 6. Matching And Fuzzy Logic

Current `index.html` primary functions:

- `escapeRegExp`
- `tokenizeForFuzzy`
- `tokenEditDistance`
- `findFuzzySentenceEnd`
- `findTargetEnd`
- `textMatchesTarget`
- `findWordEnd`
- `isSentenceTarget`

Current behavior:

- Exact target match uses word-boundary regular expressions.
- Multi-word targets can fuzzy-match by token edit distance if sentence fuzzy threshold is less than 100%.
- Symbol/dotted target normalization is handled by `spokenTarget` in `findTargetEnd`:
  - `*` becomes `star`.
  - dots before alphanumeric characters become spaces.
  - trailing punctuation is stripped.
- Single-word partial fuzzy matching from `fuzzy_match.html` is not present in `index.html`.

`fuzzy_match.html` additional behavior:

- `collectTranscriptMatches` merges exact and partial matches for display.
- `findPartialTargetMatch` can match imperfect single words.
- `characterEditDistance` and `wordSimilarity` score single-token similarity.
- `tokenizeForFuzzy` expands "im"/"i'm" to `i am`.
- `findFuzzySentenceEnd` has an additional partial sentence-window pass.

Refactor target:

- `matching/normalization.js`
- `matching/exactMatch.js`
- `matching/fuzzySentence.js`
- `matching/partialWord.js`
- Unit tests with captured examples:
  - exact word
  - multi-word sentence
  - punctuation
  - `Delete *`
  - dotted file names
  - "I'm" vs "I am"
  - false positives around current target order

### 7. Word List, Status, Score, And HUD

Primary functions:

- `renderWordList`
- `renderLevelStatus`
- `renderScoreDisplay`
- `renderLivesDisplay`
- `renderSequenceStatus`
- `colorSpan`

The UI is rendered imperatively from global state. `renderSequenceStatus` is the central status render and calls level status, music degradation sync, and timeline rendering.

`renderScoreDisplay` combines current level score with `completedPhrasesFromLevel1` when in Level 2. `renderLivesDisplay` only renders content in `lives` mode.

Couplings:

- Rendering functions trigger non-render side effects such as `syncMusicDegradationToLevel`.
- HUD depends on sequence mode and target entries.
- `renderWordList` uses `innerHTML` for checkbox shell and then sets span text safely.

Refactor target:

- Split render-only functions from side-effect synchronization.
- A derived selector layer:
  - `selectScore(state)`
  - `selectLivesDisplay(state)`
  - `selectSequenceStatus(state)`
  - `selectWordListItems(state)`

### 8. ASCII World Renderer

Primary functions:

- `getRoadMetrics`
- `hashCell`
- `groundProp`
- `underseaProp`
- `renderLevel2CableRoad`
- `renderRoad`
- `buildRoad`
- `renderTimeline`
- `getWallBounds`
- `createScaryFireFrames`
- `getCurrentFireFrame`
- `fillChainLinkFenceRow`
- `fillDigitalFirewallRow`
- `renderBurningWall`
- `renderChainLinkFence`
- `renderRoadMiddle`
- `getWallCharClass`
- `getFenceCharClass`

Current renderer model:

- `buildRoad` creates an array of character rows.
- Environment determines background and road lane:
  - Level 1: ground props, lane borders, center road marks, chain-link fence obstacle.
  - Level 2: undersea props, cable-road strips, digital firewall obstacle.
- `renderRoad` converts row segments into styled spans and writes to `#timeline`.
- `renderTimeline` calculates wall position from deadline progress and controls gate animation.
- `hashCell` creates deterministic pseudo-random scenery.

The renderer is mostly deterministic except for time-based calls to `Date.now()` and current global level/player state.

Couplings:

- Renderer reads DOM metrics, global current level, global keygen state, deadline state, and mode state.
- Collision detection is called from inside `renderTimeline`, causing rendering to mutate game state via `handleDeadline`.
- CSS class names are embedded in renderer logic.

Refactor target:

- `renderer/roadMetrics`
- `renderer/buildRoadFrame(state, viewport, time)`
- `renderer/renderPre(frame, element)`
- Move collision detection out of rendering into game loop/update.
- Inject `time` and `environment` rather than reading globals.

### 9. Player/Keygen Character

Primary functions:

- `setKeygenCharacterState`
- `getKeygenCharacterState`
- `triggerVoiceSignal`
- `triggerKeygenFail`
- `triggerKeygenCollisionFail`
- `triggerKeygenRespawn`
- `updateKeygenDistortion`
- `getPlayerBounds`
- `createKeygenLines`
- `createPassportLines`
- `createPasswordKeyLines`
- `createPlayerLines`
- `createVoiceSignalLines`
- `drawPlayerCharacter`
- `getPlayerCharClass`

Current behavior:

- Level 1 player visual is passport-like.
- Level 2 player visual is password-key-like.
- The character has timed states: idle, speaking/success signal, fail, broken, glitch.
- Distortion increases by level/music degradation and changes rendered characters/classes.
- Collision with obstacle calls fail behavior and SFX.

Couplings:

- Player drawing is embedded in the road renderer.
- Player state is part of global state, not level state.
- Collision detection depends on renderer-computed obstacle row and player bounds.

Refactor target:

- `player/model.js` for state and timed transitions.
- `player/asciiSprites.js` for sprite definitions.
- `collision/checkObstaclePlayerCollision(frameState)`.

### 10. Visualizer And Visual Effects

Current `index.html` primary functions:

- `drawIdleVisualizer`
- `updateAsciiWaveformBackground`
- `updateGameOverWaveform`
- `updateGameOverFire`
- `generateAsciiWaveform`
- `startVisualizer`
- `stopVisualizer`

Current visualizer design:

- Uses microphone time-domain data to compute amplitude.
- Renders an ASCII waveform into `#ascii-waveform-bg`.
- Renders game-over waveform into a `<pre>`.
- Animates fire with `createScaryFireFrames`.
- Uses an idle RAF loop when the microphone is not active.

`fuzzy_match.html` differs:

- Uses canvas visualizers.
- Uses frequency-domain data.
- Has `drawIdleVisualizerCanvas` and `drawSpectrumCanvas`.

Couplings:

- Visualizer owns microphone stream and `audioContext`, but echo and talk-back reuse the same `micStream` and `audioContext`.
- `stopVisualizer` closes the shared audio context and then restarts idle visuals.

Refactor target:

- `audio/MicrophoneService` owns stream and audio context.
- `visualizers/asciiWaveform`
- `visualizers/canvasSpectrum` only if preserving the fuzzy prototype visualizer.
- Consumers should subscribe to amplitude/frequency data rather than owning mic lifecycle.

### 11. Level 2 Memory/Enemy Phrase System

Primary functions:

- `stopMemoryPhraseSystem`
- `createLevel2MatrixFragment`
- `getLevel2EnemyTargetCount`
- `createLevel2Enemy`
- `syncLevel2EnemyCount`
- `startMemoryPhraseSystem`
- `updateMemoryPhraseSystem`

Current behavior:

- Level 2 displays floating phrase fragments and matrix-like strings.
- Source phrases prefer `completedPhrasesFromLevel1`, falling back to `LEVEL_2_MOCK_PHRASES`.
- Enemy count increases with `level2CompletedWordCount`.
- Movement is RAF-driven with random direction changes, glitches, bursts, wrapping, opacity flicker, and transforms.

Couplings:

- Directly creates DOM elements and mutates their style.
- Reads `currentLevel`, `level2CompletedWordCount`, `completedPhrasesFromLevel1`, and window dimensions.
- `useMockMemories` parameter is accepted by `startMemoryPhraseSystem`, but current implementation always uses completed Level 1 phrases if available, otherwise mock phrases.

Refactor target:

- `effects/memoryPhrases/model`
- `effects/memoryPhrases/domRenderer`
- Make source selection explicit and testable.

### 12. AudioManager: Music And SFX

Primary module:

- `AudioManager` IIFE.

Primary functions:

- `preloadAll`
- `startMainTheme`
- `stopMainTheme`
- `duckMusic`
- `restoreMusic`
- `fadeMusicVolume`
- `updateMusicDegradation`
- `updateLevel2MusicDegradation`
- `setDistortionAmount`
- `setBitcrusherAmount`
- `playLevelFailedSound`
- `playRespawnSound`
- `playWallPassSound`

Assets:

- `assets/audio/main_sound_theme.ogg`
- `assets/audio/main_sound_theme.mp3`
- `assets/audio/game_fx_level_failed.wav`
- `assets/audio/game_fx_respawn.wav`
- `assets/audio/game_fx_wall_pass.wav`

Current behavior:

- Main theme is an `Audio` element with OGG/MP3 sources.
- Web Audio graph applies distortion, bitcrusher, and lowpass.
- SFX clone audio nodes and temporarily duck the music.
- Degradation is queued until audio is unlocked by user/game start.
- Level 2 degradation increases per completed phrase.

Couplings:

- Level systems call degradation updates directly.
- SFX calls are embedded in game transitions.
- Uses deprecated `createScriptProcessor` for bitcrusher.

Refactor target:

- Keep `AudioManager` as a real module/service.
- Replace `createScriptProcessor` with AudioWorklet later if needed.
- Expose idempotent lifecycle methods and event-based triggers.

### 13. Echo System

Primary functions:

- `echoEnabled`
- `echoAllows`
- `startEchoSystem`
- `stopEchoSystem`
- `startEchoSegment`
- `cutEchoSnippet`
- `finalizeEchoSegment`
- `trimSilence`
- `computeRms`
- `computePeaks`
- `drawSnippetWave`
- `renderEchoPanel`
- `getEchoProgress`
- `buildReverbImpulse`
- `ensureEchoBus`
- `updateEchoBus`
- `maybeTriggerEcho`
- `pickEchoSnippet`
- `pickEchoRate`
- `initiateEcho`
- `playEcho`
- `cancelActiveEchoes`
- `clearEchoSnippets`

Current behavior:

- Records the microphone in rolling segments.
- Final speech-recognition chunks label each segment.
- Segments are decoded, silence-trimmed, RMS-filtered, peak-rendered, and stored.
- Echo playback is randomly or key-moment triggered depending on `#echo-mode`.
- Playback pitch/rate is shifted and sent through a shared delay/reverb bus.
- Current target text is excluded from echo snippet selection where possible to reduce accidental self-solving.

Couplings:

- Depends on shared `micStream` and `audioContext`.
- Trigger probabilities read game progress.
- UI render and audio playback state share the same snippet objects.

Refactor target:

- `echo/EchoRecorder`
- `echo/EchoSnippetStore`
- `echo/EchoFxBus`
- `echo/EchoTriggerPolicy`
- Keep silence trimming and peak computation pure/testable.

### 14. Talk-Back TTS System

Primary functions:

- `talkbackEnabled`
- `setTalkbackStatus`
- `renderTalkbackPanel`
- `getTalkbackEndpoint`
- `talkbackUrl`
- `fetchWithTimeout`
- `checkTalkbackHealth`
- `startTalkbackHealthChecks`
- `getTalkbackThreshold`
- `getTalkbackProgress`
- `getTalkbackPhrases`
- `canTalkback`
- `startTalkbackCaptureSystem`
- `stopTalkbackCaptureSystem`
- `startTalkbackSegment`
- `cutTalkbackSegment`
- `finalizeTalkbackSegment`
- `selectTalkbackReference`
- `encodeWavFromBuffers`
- `writeAscii`
- `ensureTalkbackRef`
- `maybeTriggerTalkback`
- `queueTalkbackPrompt`
- `runTalkbackQueue`
- `generateTalkback`
- `absolutizeTalkbackAudioUrl`
- `playTalkbackAudio`

API endpoints:

- `GET /api/health`
- `POST /api/refs`
- `POST /api/generate`

Current behavior:

- Health checks run every 7 seconds.
- Talk-back segments are recorded from the same mic stream as echo.
- A reference is selected once enough voice material exists.
- Multiple short segments can be encoded into a WAV reference.
- Prompts are selected from `#talkback-phrases`.
- Generated audio is played using an `Audio` element.
- `talkbackSessionId` invalidates stale async work after stops/clears.

`fuzzy_match.html` additionally has `getDefaultTalkbackEndpoint` and `applyDefaultTalkbackEndpoint`, including a tunnel endpoint for a specific GitHub Pages deployment. Current `index.html` removed this and leaves the input default at `http://127.0.0.1:8000`.

Couplings:

- Depends on mic/audio context, matching progress, settings DOM, network API, and panel DOM.
- Shares audio utility functions with echo (`trimSilence`, `computeRms`) but they are not isolated.
- `fetchWithTimeout` is generic but lives inside the talk-back section.

Refactor target:

- `talkback/TalkbackClient`
- `talkback/ReferenceRecorder`
- `talkback/ReferenceSelector`
- `talkback/TalkbackQueue`
- Shared `audio/bufferUtils` for RMS, trim, WAV encoding.

### 15. Event Wiring And Bootstrapping

Main event sources:

- Settings inputs.
- Onboarding button and Enter key.
- Dev level buttons and dev keyboard shortcuts.
- Speech recognition events.
- MediaRecorder events.
- Audio playback ended/error events.
- Resize event.
- Clear/reset buttons.
- Timers and RAF loops.

Boot sequence in `index.html`:

1. `renderWordList()`
2. `renderSequenceStatus()`
3. `renderTalkbackPanel()`
4. `startTalkbackHealthChecks()`
5. `AudioManager.preloadAll()`
6. `drawIdleVisualizer()`
7. Focus onboarding action.
8. Initialize SpeechRecognition if available.
9. Register start/stop/clear handlers.

Couplings:

- Listener registration is order-dependent.
- Startup begins health polling before the user starts the game.
- Speech recognition support gates some controls but not all microphone-dependent UI.

Refactor target:

- `main.js` should only compose modules:
  - query DOM
  - create services
  - create state store
  - wire event subscriptions
  - start boot tasks

## Cross-Cutting Dependencies

### Browser APIs

- Web Speech API: recognition and interim/final transcript events.
- MediaDevices/getUserMedia: microphone stream.
- Web Audio API: analyser, media stream source, buffer decoding, effects.
- MediaRecorder: echo and talk-back segment capture.
- Fetch/FormData/AbortController: TTS API.
- Audio element: music, SFX, generated talk-back playback.
- DOM APIs: query selectors, classList, replaceChildren, inline styles, event listeners.
- Canvas API: road metric text measuring and echo snippet waveforms; fuzzy prototype also uses canvas visualizers.

### External Assets And Services

- Font: `./Web Fonts/Pexico.woff2`, `./Web Fonts/Pexico.woff`.
- Audio assets under `assets/audio`.
- TTS service expected at `http://127.0.0.1:8000` by default.
- TTS model constant: `qwen3-tts-0.6b-base`.

### Shared Utility Concepts

- Time: `Date.now()` and `performance.now()` are used throughout.
- Randomness: Level 2 enemies, echo triggers, talk-back triggers, reverb impulse.
- Text normalization: several matching paths normalize differently.
- Audio buffer processing: echo and talk-back share needs.

## Current Architectural Risks

1. Global mutable state makes behavior hard to reason about. Many functions can alter progression, audio, DOM, timers, and capture state together.
2. Rendering has side effects. `renderSequenceStatus` syncs music degradation, and `renderTimeline` can trigger collision failure.
3. Microphone/audio context ownership is ambiguous. Visualizer starts/stops the stream and context used by echo and talk-back.
4. Matching behavior has drifted. `fuzzy_match.html` supports partial single-word matching that current `index.html` does not.
5. Content sources conflict. Level 2 appears in the textarea but current code uses `LEVEL_2_ROUNDS`.
6. Current and snapshot files are duplicated. Bug fixes can diverge silently across `index.html` and `index-2026-06-19.html`.
7. Dev mode is hard-coded true in current `index.html`.
8. Talk-back local service assumptions are embedded in UI defaults and network code.
9. CSS and JS class contracts are implicit. Renderer class names and CSS selectors are coupled by strings.
10. There are no visible automated tests around matching, state transitions, audio buffer utilities, or level parsing.

## Refactor-Oriented Module Map

Recommended extraction order:

1. `matching/`
   - Lowest DOM dependency.
   - Highest need for regression tests.
   - Preserve current matching plus desired fuzzy prototype behavior.

2. `content/`
   - Move `LEVEL_2_ROUNDS`, level metadata, and textarea parsing.
   - Make source of truth explicit.

3. `game/`
   - Extract state shape and reducer/state machine.
   - Keep DOM rendering outside this layer.

4. `renderers/ascii/`
   - Extract road frame generation from DOM patching.
   - Inject state, viewport, and time.

5. `audio/`
   - Separate music/SFX from microphone stream management.
   - Create shared buffer utilities.

6. `speech/`
   - Wrap SpeechRecognition.
   - Emit normalized transcript events.

7. `echo/` and `talkback/`
   - Split capture, storage, trigger policy, API client, and rendering.

8. `ui/`
   - Onboarding, game-over, settings, HUD, word list, panels.

Suggested future file layout:

```text
src/
  main.js
  dom/
    elements.js
  config/
    gameConfig.js
  content/
    levels.js
    parseTargetPlan.js
  game/
    initialState.js
    reducer.js
    selectors.js
    timers.js
  matching/
    normalize.js
    exact.js
    fuzzySentence.js
    partialWord.js
    index.js
  renderers/
    ascii/
      metrics.js
      roadFrame.js
      obstacles.js
      playerSprites.js
      domRenderer.js
  audio/
    musicManager.js
    microphone.js
    bufferUtils.js
  speech/
    speechRecognitionService.js
    transcriptStore.js
  echo/
    echoRecorder.js
    echoStore.js
    echoFxBus.js
    echoPolicy.js
    echoPanel.js
  talkback/
    client.js
    referenceRecorder.js
    referenceSelector.js
    queue.js
    panel.js
  ui/
    onboarding.js
    gameOver.js
    settings.js
    hud.js
    wordList.js
    levelIntro.js
  effects/
    asciiWaveform.js
    memoryPhrases.js
```

## Tests To Add Before Major Refactor

High-value tests:

- `parseTargetPlan` parses headings, sequence headings, blank lines, and phrase entries.
- `findTargetEnd` exact matching does not overmatch substrings.
- Fuzzy sentence matching respects the configured threshold.
- Symbol normalization handles `Delete *`, dotted file names, and trailing punctuation.
- If preserving prototype behavior, partial word matching catches intended near-misses but rejects short unsafe words.
- Sequence reducer handles:
  - beat hit before deadline
  - beat miss in rhythm mode
  - life loss and retry decrement in lives mode
  - phrase completion and level transition
  - continue phrase after failure
  - reset behavior
- Echo buffer utilities:
  - silence trimming
  - RMS threshold
  - peak bucket generation
  - WAV encoding from buffers

## Migration Notes

- Keep `index.html` behavior as the acceptance baseline.
- Decide explicitly whether `fuzzy_match.html` partial single-word matching should be restored to the main app.
- Avoid carrying `index-2026-06-19.html` forward as an active code branch; it is too similar to justify parallel maintenance.
- During extraction, keep the same DOM initially. Move logic first, then redesign UI structure.
- Create a thin compatibility layer that exposes current globals during transition if needed.
- Extract pure functions first; defer bundler/framework choices until the core behavior has tests.

## Bottom Line

The current implementation is best understood as a set of working subsystem prototypes living in one runtime namespace. The main refactor risk is not lack of modules; it is hidden coupling through global state and side effects during rendering. The safest path is to formalize state, matching, content, and renderer data first, then wrap browser services with clear lifecycles.
