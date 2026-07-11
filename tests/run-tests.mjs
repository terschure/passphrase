import assert from "node:assert/strict";
import { bindActionEvents } from "../src/app/actionBindings.js";
import { bindControlEvents } from "../src/app/controlBindings.js";
import { createLevelCatalog } from "../src/content/levelCatalog.js";
import {
    parseGameScript,
    parseTargetPlan,
} from "../src/content/targetPlan.js";
import { resolveEnvironment } from "../src/content/environments.js";
import {
    collectFinalChunks,
    collectLiveTranscript,
} from "../src/speech/recognitionResults.js";
import {
    createRecognitionResultHandler,
    createSpeechServiceCallbacks,
} from "../src/speech/recognitionFlow.js";
import { createTranscriptState } from "../src/speech/transcriptState.js";
import {
    findFuzzyWordMatch,
    findJoinedTargetMatch,
    findOrderedMatchEnd,
    findTargetEnd,
    textMatchesTarget,
} from "../src/matching/matching.js";
import {
    collectTranscriptMatches,
    renderTranscriptInto,
} from "../src/ui/transcript.js";
import {
    acceptContinuePhrase,
    clearWordGameOverCounts,
    createInitialGameState,
    getCaughtBeatDeadline,
    handleBeatDeadline,
    markCurrentWordCaught,
    recordWordGameOver,
    resetSequence,
    shouldAutoPassWord,
} from "../src/game/rules.js";
import { consumeCatchText } from "../src/game/catchMode.js";
import {
    createLevelActivationState,
    getKeygenDistortionForLevel,
    getNextLevel,
} from "../src/game/levelProgression.js";
import { createLevelProgressionEffects } from "../src/game/levelProgressionEffects.js";
import {
    consumeSequenceText,
    findSequenceSearchStart,
} from "../src/game/sequenceText.js";
import { createVocalizationDetector } from "../src/game/vocalization.js";
import {
    computePeaks,
    computeRms,
    encodeWavFromFloat32,
    trimSilence,
} from "../src/audio/bufferUtils.js";
import {
    discardRecorder,
    startSegmentRecorder,
} from "../src/audio/segmentRecorder.js";
import {
    AUDIO_MIX_CONFIG,
    createMusicManager,
} from "../src/audio/musicManager.js";
import { readConfig } from "../src/ui/domRefs.js";
import { createLevelIntroController } from "../src/ui/levelIntro.js";
import {
    getRoadMetricsFromViewport,
    obstacleIntersectsPlayer,
} from "../src/renderers/ascii/hash.js";
import {
    createPlayerLines,
    getPlayerBounds,
    getPlayerCharClass,
} from "../src/renderers/ascii/player.js";
import { createKeygenCharacter } from "../src/renderers/ascii/keygenCharacter.js";
import {
    createScaryFireFrames,
    getWallBounds,
    renderLevel2CableRoad,
    WALL_HEIGHT,
} from "../src/renderers/ascii/roadScene.js";
import { createRoadAnimation } from "../src/renderers/ascii/roadAnimation.js";
import { createTimelineRenderState } from "../src/renderers/ascii/timelineState.js";
import {
    buildRoadRows,
    formatWallLabelLines,
} from "../src/renderers/ascii/roadRenderer.js";
import {
    echoAllows,
    pickEchoRate,
    selectEchoSnippet,
    shouldTriggerEcho,
} from "../src/echo/policy.js";
import {
    ECHO_RUNTIME_CONFIG,
    getPreferredEchoMimeType,
} from "../src/echo/defaultConfig.js";
import { buildReverbImpulse } from "../src/echo/fxBus.js";
import { createEchoRuntime } from "../src/echo/runtime.js";
import { generateAsciiWaveform } from "../src/effects/asciiWaveform.js";
import {
    createMicrophoneVisualizer,
    getWaveformAmplitude,
} from "../src/effects/microphoneVisualizer.js";
import {
    createLevel2MatrixFragment,
    DEFAULT_MEMORY_PHRASE_ENEMY_CONFIG,
    getMemoryPhraseEnemyTargetCount,
} from "../src/effects/memoryPhraseEnemies.js";
import { absolutizeTalkbackAudioUrl } from "../src/talkback/client.js";
import { createTalkbackGenerationCache } from "../src/talkback/cache.js";
import {
    createTalkbackRuntime,
    encodeWavFromBuffers,
} from "../src/talkback/runtime.js";
import {
    selectTalkbackReference,
    talkbackUrl,
} from "../src/talkback/reference.js";
import {
    getTalkbackTriggerProbability,
    TALKBACK_RUNTIME_CONFIG,
} from "../src/talkback/defaultConfig.js";
import {
    DEPLOYED_TALKBACK_ENDPOINT,
    LOCAL_TALKBACK_ENDPOINT,
    getDefaultTalkbackEndpoint,
} from "../src/talkback/endpoint.js";

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

function makeBuffer(channels, sampleRate = 1000) {
    const channelData = channels.map((channel) => Float32Array.from(channel));
    return {
        numberOfChannels: channelData.length,
        length: channelData[0].length,
        sampleRate,
        duration: channelData[0].length / sampleRate,
        getChannelData(channel) {
            return channelData[channel];
        },
        copyToChannel(data, channel) {
            channelData[channel].set(data);
        },
    };
}

function createMockBuffer(numberOfChannels, length, sampleRate) {
    return makeBuffer(
        Array.from({ length: numberOfChannels }, () =>
            Array.from({ length }, () => 0),
        ),
        sampleRate,
    );
}

function createEventTarget() {
    const listeners = new Map();
    return {
        addEventListener(type, listener) {
            const current = listeners.get(type) || [];
            listeners.set(type, [...current, listener]);
        },
        dispatch(type, event = {}) {
            for (const listener of listeners.get(type) || []) {
                listener({ type, ...event });
            }
        },
    };
}

function createControlBindingRefs() {
    return Object.fromEntries(
        [
            "wordsInput",
            "modeInput",
            "secondsInput",
            "livesInput",
            "retriesInput",
            "transcriptSourceInput",
            "sentenceFuzzyMatchInput",
            "continuePhraseInput",
            "echoModeInput",
            "talkbackEnabledInput",
            "talkbackEndpointInput",
            "talkbackThresholdInput",
            "resetSequenceButton",
            "openSettingsButton",
            "closeSettingsButton",
            "settingsBackdrop",
        ].map((name) => [name, createEventTarget()]),
    );
}

function createActionBindingRefs() {
    return {
        onboardingAction: createEventTarget(),
        startButton: createEventTarget(),
        stopButton: createEventTarget(),
        clearButton: createEventTarget(),
    };
}

function createClassList() {
    const classes = new Set();
    return {
        add(...names) {
            for (const name of names) {
                classes.add(name);
            }
        },
        remove(...names) {
            for (const name of names) {
                classes.delete(name);
            }
        },
        contains(name) {
            return classes.has(name);
        },
        values() {
            return [...classes].sort();
        },
    };
}

function createElementFake() {
    return {
        textContent: "",
        attributes: {},
        classList: createClassList(),
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
    };
}

test("parseTargetPlan preserves levels and sequences", () => {
    const entries = parseTargetPlan(`# Level A
## Round 1
Alpha

## Round 2
Beta
# Level B
## Round 1
Gamma`);

    assert.equal(entries.length, 3);
    assert.deepEqual(entries[0], {
        text: "Alpha",
        soundOnly: false,
        levelTitle: "Level A",
        sequenceTitle: "Round 1",
        levelIndex: 0,
        sequenceIndex: 0,
    });
    assert.equal(entries[1].sequenceTitle, "Round 2");
    assert.equal(entries[1].sequenceIndex, 1);
    assert.equal(entries[2].levelTitle, "Level B");
    assert.equal(entries[2].levelIndex, 1);
    assert.equal(entries[2].sequenceIndex, 0);
});

test("parseGameScript marks *wrapped* lines as sound-only targets", () => {
    const { levels } = parseGameScript(`# Level 1
## Round 1
*hmmm*
* ahh *
Albania
Delete *
Delete *.mp3 files`);

    const entries = levels[0].entries;
    assert.deepEqual(
        entries.map((e) => [e.text, e.soundOnly]),
        [
            ["hmmm", true],
            ["ahh", true],
            ["Albania", false],
            ["Delete *", false],
            ["Delete *.mp3 files", false],
        ],
    );
});

test("vocalization detector fires once after sustained sound, then re-arms", () => {
    const detector = createVocalizationDetector({ threshold: 0.2, minMs: 300 });

    assert.equal(detector.sample(0.05, 0), false); // silence
    assert.equal(detector.sample(0.5, 100), false); // timer starts
    assert.equal(detector.sample(0.5, 300), false); // 200ms < 300ms
    assert.equal(detector.sample(0.5, 450), true); // crosses minMs -> fires
    assert.equal(detector.sample(0.5, 600), false); // disarmed until a dip
    assert.equal(detector.sample(0.0, 700), false); // dip re-arms
    assert.equal(detector.sample(0.5, 800), false); // timer restarts
    assert.equal(detector.sample(0.5, 1200), true); // fires again
});

test("parseGameScript reads level metadata, comments, and header zone", () => {
    const { levels } = parseGameScript(`> a comment line
# Level 1
subtitle: Border Checkpoint
environment: border-fence
talkback-frequency: 0.5
## Round 1
Albania
Exit
# Level 2
subtitle: Undersea Cable
environment: undersea-cable
talkback-frequency: 9
## Round 1
Monkey
environment: not-metadata-after-round`);

    assert.equal(levels.length, 2);
    assert.equal(levels[0].name, "Level 1");
    assert.equal(levels[0].subtitle, "Border Checkpoint");
    assert.equal(levels[0].environment, "border-fence");
    assert.equal(levels[0].talkbackFrequency, 0.5);
    assert.equal(levels[0].id, 1);
    assert.deepEqual(
        levels[0].entries.map((entry) => entry.text),
        ["Albania", "Exit"],
    );
    assert.equal(levels[1].environment, "undersea-cable");
    assert.equal(levels[1].talkbackFrequency, 4);
    // a "key: value" line after a round starts is a phrase, not metadata
    assert.deepEqual(
        levels[1].entries.map((entry) => entry.text),
        ["Monkey", "environment: not-metadata-after-round"],
    );
});

test("parseGameScript reads talkback pool and positional cues", () => {
    const { levels } = parseGameScript(`# Level 1
environment: border-fence

## Talkback
How can I help you?
Here is your dopamine hit

## Round 1
Albania
Exit
~ Sorry, this checkpoint is now closed
Germany`);

    const level = levels[0];
    // random pool is captured and NOT treated as target phrases
    assert.deepEqual(level.talkbackRandom, [
        "How can I help you?",
        "Here is your dopamine hit",
    ]);
    assert.deepEqual(
        level.entries.map((entry) => entry.text),
        ["Albania", "Exit", "Germany"],
    );
    // the inline cue is anchored after "Exit" (entry index 1)
    assert.equal(level.talkbackCues.length, 1);
    assert.deepEqual(level.talkbackCues[0], {
        afterIndex: 1,
        text: "Sorry, this checkpoint is now closed",
    });
});

test("parseGameScript defaults environment and tolerates missing headings", () => {
    const { levels } = parseGameScript(`Alpha
Beta`);
    assert.equal(levels.length, 1);
    assert.equal(levels[0].name, "Level 1");
    assert.equal(levels[0].environment, "border-fence");
    assert.equal(levels[0].entries.length, 2);
    assert.equal(levels[0].entries[0].sequenceTitle, "Main sequence");
});

test("resolveEnvironment maps known presets and falls back safely", () => {
    assert.equal(
        resolveEnvironment("undersea-cable").character,
        "password-key",
    );
    assert.equal(resolveEnvironment("border-fence").character, "passport");
    assert.equal(resolveEnvironment("nonexistent").character, "passport");
    assert.equal(resolveEnvironment(undefined).id, "border-fence");
});

test("level catalog derives levels and entries from the parsed script", () => {
    const scriptLevels = [
        {
            id: 1,
            name: "Level 1",
            subtitle: "Border",
            environment: "border-fence",
            rounds: [],
            entries: [
                {
                    text: "Alpha",
                    levelTitle: "Level 1",
                    sequenceTitle: "Round 1",
                    levelIndex: 0,
                    sequenceIndex: 0,
                },
            ],
        },
        {
            id: 2,
            name: "Level 2",
            subtitle: "Undersea",
            environment: "undersea-cable",
            rounds: [],
            entries: [
                {
                    text: "Gamma",
                    levelTitle: "Level 2",
                    sequenceTitle: "Round 1",
                    levelIndex: 1,
                    sequenceIndex: 0,
                },
            ],
        },
    ];
    const catalog = createLevelCatalog({
        getScriptLevels: () => scriptLevels,
    });

    assert.equal(catalog.getLevels().length, 2);
    assert.equal(catalog.getLevelConfig(2).environment, "undersea-cable");
    assert.equal(catalog.getLevelConfig(2).subtitle, "Undersea");
    assert.equal(catalog.getLevelEntries(1)[0].text, "Alpha");
    assert.equal(catalog.getLevelEntries(2)[0].text, "Gamma");
    // unknown id falls back to the first level
    assert.equal(catalog.getLevelConfig(99).id, 1);
});

test("matching handles exact targets and avoids substrings", () => {
    assert.equal(textMatchesTarget("arrival at the gate", "Arrival"), true);
    assert.equal(textMatchesTarget("the exiter is here", "Exit"), false);
});

test("matching handles spoken symbol normalization", () => {
    assert.equal(textMatchesTarget("please delete star now", "Delete *"), true);
    assert.equal(
        textMatchesTarget("delete star mp3 files", "Delete *.mp3 files"),
        true,
    );
});

test("matching handles fuzzy multi-word phrases", () => {
    assert.equal(
        textMatchesTarget("i am master of my data", "I am the master of my data", {
            fuzzyThreshold: 0.72,
        }),
        true,
    );
    assert.equal(
        textMatchesTarget("totally unrelated sentence", "I am the master of my data", {
            fuzzyThreshold: 0.78,
        }),
        false,
    );
});

test("matching handles fuzzy single-word targets conservatively", () => {
    assert.equal(textMatchesTarget("the squirl escaped", "Squirrel"), true);
    assert.equal(textMatchesTarget("take the exits", "Exit"), true);
    assert.equal(textMatchesTarget("say exot", "Exit"), false);
    assert.equal(textMatchesTarget("the cut sat down", "Cat"), false);
    assert.equal(textMatchesTarget("a squi appeared", "Squirrel"), false);
    assert.equal(textMatchesTarget("totally unrelated", "Squirrel"), false);
});

test("matching accepts joined and split target transcriptions", () => {
    assert.equal(textMatchesTarget("la la", "Lala"), true);
    assert.equal(
        textMatchesTarget("lala", "La la", { fuzzyThreshold: 1 }),
        true,
    );
    assert.equal(
        textMatchesTarget("nomnomnom", "Nom nom nom", {
            fuzzyThreshold: 1,
        }),
        true,
    );
    assert.equal(textMatchesTarget("la di la", "Lala"), false);

    assert.deepEqual(findJoinedTargetMatch("lala then la la", "La la", 4), {
        start: 10,
        end: 15,
    });
    assert.equal(
        findOrderedMatchEnd("rural la la", ["Lala", "Rural"], 1),
        -1,
    );
});

test("matching accepts a fuzzy word split across transcript tokens", () => {
    assert.equal(
        textMatchesTarget(
            "favorite character unique code",
            "favorite character unicode",
        ),
        true,
    );
    assert.equal(
        textMatchesTarget(
            "favorite character banana",
            "favorite character unicode",
        ),
        false,
    );
    assert.equal(
        textMatchesTarget(
            "favorite cartoon unique code",
            "favorite character unicode",
        ),
        false,
    );
    assert.equal(
        textMatchesTarget(
            "favorite character unique code",
            "favorite character unicode",
            { fuzzyThreshold: 1 },
        ),
        false,
    );
});

test("fuzzy word matching respects transcript offsets", () => {
    const match = findFuzzyWordMatch("squirl then squirre", "Squirrel", 6);

    assert.deepEqual(match, {
        start: 12,
        end: 19,
        score: 0.875,
    });
    assert.equal(
        findOrderedMatchEnd("rural squirl", ["Squirrel", "Rural"], 1),
        -1,
    );
});

test("transcript matching prefers exact ranges and marks fuzzy words", () => {
    const escapeRegExp = (text) =>
        String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = collectTranscriptMatches(
        "squirl then squirrel",
        ["Squire", "Squirrel"],
        escapeRegExp,
    );

    assert.deepEqual(
        matches.map(({ kind, start, end }) => ({ kind, start, end })),
        [
            { kind: "partial", start: 0, end: 6 },
            { kind: "exact", start: 12, end: 20 },
        ],
    );
    assert.deepEqual(
        collectTranscriptMatches(
            "squirrel",
            ["Squire", "Squirrel"],
            escapeRegExp,
        ).map(({ kind, start, end }) => ({ kind, start, end })),
        [{ kind: "exact", start: 0, end: 8 }],
    );
    assert.deepEqual(
        collectTranscriptMatches("la la", ["Lala"], escapeRegExp).map(
            ({ kind, start, end }) => ({ kind, start, end }),
        ),
        [{ kind: "partial", start: 0, end: 5 }],
    );

    const appended = [];
    const container = {
        replaceChildren() {
            appended.length = 0;
        },
        append(...children) {
            appended.push(...children);
        },
    };

    renderTranscriptInto({
        container,
        text: "squirl then squirrel",
        words: ["Squirrel"],
        escapeRegExp,
        colorSpan: (className, text) => ({ className, text }),
    });

    assert.deepEqual(appended, [
        { className: "partial-hit", text: "squirl" },
        " then ",
        { className: "hit", text: "squirrel" },
        "",
    ]);
});

test("ordered matching anchors after completed words", () => {
    const words = ["Alpha", "Beta"];
    assert.notEqual(
        findOrderedMatchEnd("beta alpha beta", words, 1, {
            fuzzyThreshold: 1,
        }),
        -1,
    );
});

test("speech recognition result helpers collect finals and live transcript", () => {
    const event = {
        resultIndex: 1,
        results: [
            [{ transcript: "old" }],
            Object.assign([{ transcript: " alpha " }], { isFinal: true }),
            Object.assign([{ transcript: " beta " }], { isFinal: false }),
        ],
    };
    const seen = [];
    const finals = collectFinalChunks(event, {
        onText(text) {
            seen.push(text.trim());
        },
    });

    assert.deepEqual(seen, ["alpha", "beta"]);
    assert.deepEqual(finals, ["alpha"]);
    assert.equal(
        collectLiveTranscript(event, { transcriptWasWiped: true }),
        "alpha beta",
    );
    assert.equal(
        collectLiveTranscript(event, { transcriptWasWiped: false }),
        "old alpha beta",
    );
});

test("transcript state stores final/interim text and clear flags", () => {
    const state = createTranscriptState();
    state.appendFinal("alpha");
    state.appendFinal("beta");
    state.setInterim("alpha beta gamma");

    assert.equal(state.getSelected("final"), "alpha beta");
    assert.equal(state.getSelected("interim"), "alpha beta gamma");
    assert.equal(state.transcriptWasWiped, false);

    state.beginRecognitionResult();
    state.clear();
    assert.equal(state.wasWipedDuringResult(), true);
    assert.equal(state.transcriptWasWiped, true);
    assert.deepEqual(state.finalChunks, []);
    assert.equal(state.interimTranscript, "");

    state.endRecognitionResult();
    state.beginRecognitionResult();
    assert.equal(state.wasWipedDuringResult(), false);
});

test("recognition flow handles finals, interim text, and side effects", () => {
    const transcriptState = createTranscriptState();
    const calls = [];
    const event = {
        resultIndex: 0,
        results: [
            Object.assign([{ transcript: " alpha " }], { isFinal: true }),
            Object.assign([{ transcript: " beta " }], { isFinal: false }),
        ],
    };
    const handler = createRecognitionResultHandler({
        transcriptState,
        isGameStarted: () => true,
        isStartCommand: (text) => text.toLowerCase().includes("start"),
        startGameFromVoice: () => calls.push("voiceStart"),
        getTranscriptSource: () => "interim",
        getMode: () => "ordered",
        triggerVoiceSignal: (state) => calls.push(`signal:${state}`),
        processTranscriptText: (text) => calls.push(`process:${text.trim()}`),
        rebuildCatchWordsFromSource: () => calls.push("rebuildCatch"),
        renderTranscript: () => calls.push("renderTranscript"),
        renderWordList: () => calls.push("renderWords"),
        cutEchoSnippet: (label) => calls.push(`echo:${label}`),
        cutTalkbackSegment: (label) => calls.push(`talkback:${label}`),
        log: () => {},
    });

    handler(event);

    assert.deepEqual(transcriptState.finalChunks, ["alpha"]);
    assert.equal(transcriptState.interimTranscript, "alpha beta");
    assert.deepEqual(calls, [
        "signal:speaking",
        "signal:speaking",
        "echo:alpha",
        "talkback:alpha",
        "process:alpha beta",
        "renderTranscript",
        "renderWords",
    ]);
});

test("speech service callbacks update recognition lifecycle state", () => {
    const recognitionState = { starting: true, listening: false };
    const status = { textContent: "" };
    const startButton = { disabled: false };
    const stopButton = { disabled: true };
    const interimText = { textContent: "draft" };
    const calls = [];
    let blocked = false;
    const callbacks = createSpeechServiceCallbacks({
        recognitionState,
        status,
        startButton,
        stopButton,
        interimText,
        isGameStarted: () => true,
        isOnboardingVoiceBlocked: () => blocked,
        setOnboardingVoiceBlocked(value) {
            blocked = value;
        },
        startOnboardingVoiceRecognition: () => calls.push("onboardingVoice"),
        triggerVoiceSignal: (state) => calls.push(`signal:${state}`),
        startRoadAnimation: () => calls.push("road"),
        shouldStartSequenceTimer: () => true,
        startSequenceTimer: () => calls.push("timer"),
        stopEchoSystem: () => calls.push("stopEcho"),
        stopTalkbackCaptureSystem: () => calls.push("stopTalkback"),
        stopVisualizer: () => calls.push("stopVisualizer"),
        drawIdleVisualizer: () => calls.push("idle"),
        onResult: () => calls.push("result"),
        log: () => {},
        warn: () => {},
    });

    callbacks.onStart();
    assert.equal(recognitionState.starting, false);
    assert.equal(recognitionState.listening, true);
    assert.equal(status.textContent, "Listening...");
    assert.equal(startButton.disabled, true);
    assert.equal(stopButton.disabled, false);
    assert.deepEqual(calls.splice(0), ["signal:speaking", "road", "timer"]);

    callbacks.onEnd();
    assert.equal(recognitionState.listening, false);
    assert.equal(status.textContent, "Stopped");
    assert.equal(interimText.textContent, "");
    assert.deepEqual(calls.splice(0), [
        "stopEcho",
        "stopTalkback",
        "stopVisualizer",
        "idle",
    ]);

    callbacks.onError({ error: "not-allowed" });
    assert.equal(blocked, true);
    assert.equal(status.textContent, "Error: not-allowed");
});

test("game rules mark beat hit without immediate advance", () => {
    const state = createInitialGameState();
    const result = markCurrentWordCaught(state, ["Alpha"], "lives");
    assert.equal(result.changed, true);
    assert.equal(state.wordCaughtThisBeat, true);
    assert.equal(state.currentWordIndex, 0);
});

test("game rules advance on beat deadline after hit", () => {
    const state = createInitialGameState({ lives: 1, retries: 0 });
    markCurrentWordCaught(state, ["Alpha"], "lives");
    const result = handleBeatDeadline(state, ["Alpha"], {
        mode: "lives",
        livesLimit: 1,
        retriesLimit: 0,
    });
    assert.equal(result.outcome, "completed");
    assert.equal(state.currentWordIndex, 1);
    assert.equal(state.sequenceFailed, false);
});

test("caught beats advance within two seconds without extending the deadline", () => {
    assert.equal(getCaughtBeatDeadline(10000, 1000), 3000);
    assert.equal(getCaughtBeatDeadline(2500, 1000), 2500);
    assert.equal(getCaughtBeatDeadline(null, 1000), 3000);
});

test("game rules track per-word game overs and arm assisted passes", () => {
    const gameOverCounts = new Map();

    assert.equal(recordWordGameOver(gameOverCounts, 0), 1);
    assert.equal(shouldAutoPassWord(gameOverCounts, 0), false);
    assert.equal(recordWordGameOver(gameOverCounts, 1), 1);
    assert.equal(recordWordGameOver(gameOverCounts, 0), 2);
    assert.equal(shouldAutoPassWord(gameOverCounts, 0), true);
    assert.equal(shouldAutoPassWord(gameOverCounts, 1), false);

    clearWordGameOverCounts(gameOverCounts);
    assert.equal(gameOverCounts.size, 0);
});

test("assisted passes preserve sequence and beat advancement rules", () => {
    const words = ["Alpha"];
    const sequenceState = createInitialGameState();
    markCurrentWordCaught(sequenceState, words, "sequence");
    assert.equal(sequenceState.currentWordIndex, 1);

    const beatState = createInitialGameState();
    markCurrentWordCaught(beatState, words, "rhythm");
    assert.equal(beatState.currentWordIndex, 0);
    assert.equal(beatState.wordCaughtThisBeat, true);

    const result = handleBeatDeadline(beatState, words, { mode: "rhythm" });
    assert.equal(result.outcome, "completed");
    assert.equal(beatState.currentWordIndex, 1);
});

test("game rules fail rhythm miss and continue resets failure", () => {
    const state = createInitialGameState();
    const result = handleBeatDeadline(state, ["Alpha"], { mode: "rhythm" });
    assert.equal(result.outcome, "failed");
    assert.equal(state.sequenceFailed, true);
    assert.equal(state.failReason, "missed the beat");
    assert.equal(acceptContinuePhrase(state), true);
    assert.equal(state.sequenceFailed, false);
});

test("game rules decrement lives and reset sequence", () => {
    const state = createInitialGameState({ lives: 2, retries: 1 });
    const result = handleBeatDeadline(state, ["Alpha", "Beta"], {
        mode: "lives",
        livesLimit: 2,
        retriesLimit: 1,
    });
    assert.equal(result.outcome, "life-lost");
    assert.equal(state.livesLeft, 1);
    assert.equal(state.retriesLeft, 0);
    resetSequence(state, { livesLimit: 2, retriesLimit: 1 });
    assert.equal(state.currentWordIndex, 0);
    assert.equal(state.livesLeft, 2);
});

test("level progression helpers select levels and activation state", () => {
    const levels = [{ id: 1 }, { id: 2 }];
    assert.deepEqual(getNextLevel(levels, 1), { id: 2 });
    assert.equal(getNextLevel(levels, 2), null);
    assert.equal(getKeygenDistortionForLevel(1), 0);
    assert.equal(getKeygenDistortionForLevel(5), 1);

    const state = createLevelActivationState({
        level: { id: 2 },
        entryCount: 9,
        showIntro: false,
        livesLimit: 4,
        retriesLimit: 1,
    });
    assert.equal(state.currentLevel, 2);
    assert.equal(state.totalWordsPerLevel, 9);
    assert.equal(state.levelTransitionActive, false);
    assert.equal(state.livesLeft, 4);
    assert.equal(state.retriesLeft, 1);
});

test("level progression effects sync visuals and Level 2 enemy counts", () => {
    let currentLevel = 1;
    const calls = [];
    const effects = createLevelProgressionEffects({
        getCurrentLevel: () => currentLevel,
        syncLevel2EnemyCount: () => calls.push("syncEnemies"),
        updateKeygenDistortion: (level) => calls.push(`distort:${level}`),
    });

    effects.syncLevelEffects();
    effects.syncLevelEffects();
    assert.deepEqual(calls.splice(0), ["distort:1"]);

    currentLevel = 2;
    effects.reset(2);
    assert.equal(effects.getLevel2CompletedWordCount(), 0);
    assert.deepEqual(calls.splice(0), ["syncEnemies"]);

    assert.equal(effects.registerSuccessfulPhrase(), true);
    assert.equal(effects.getLevel2CompletedWordCount(), 1);
    assert.deepEqual(calls.splice(0), ["syncEnemies"]);

    effects.syncLevelEffects();
    assert.deepEqual(calls.splice(0), ["distort:2"]);

    currentLevel = 1;
    assert.equal(effects.registerSuccessfulPhrase(), false);
    assert.equal(effects.getLevel2CompletedWordCount(), 1);
});

test("sequence text helper anchors matches and consumes phrases", () => {
    const words = ["Alpha", "Beta", "Gamma"];
    const findWordEnd = (text, word, fromIndex = 0) => {
        const index = text.toLowerCase().indexOf(word.toLowerCase(), fromIndex);
        return index === -1 ? -1 : index + word.length;
    };

    assert.equal(
        findSequenceSearchStart("beta alpha beta", words, 1, findWordEnd),
        10,
    );

    const state = createInitialGameState({ currentLevel: 1 });
    const result = consumeSequenceText(state, words, "alpha beta", {
        mode: "ordered",
        findWordEnd,
    });
    assert.equal(result.changed, true);
    assert.deepEqual(result.completedPhrases, ["Alpha", "Beta"]);
    assert.equal(state.currentWordIndex, 2);
    assert.deepEqual(state.completedPhrasesFromLevel1, ["Alpha", "Beta"]);

    const beatState = createInitialGameState();
    const beatResult = consumeSequenceText(beatState, words, "alpha", {
        mode: "lives",
        findWordEnd,
    });
    assert.equal(beatResult.beatHit, true);
    assert.equal(beatState.currentWordIndex, 0);
    assert.equal(beatState.wordCaughtThisBeat, true);
});

test("catch mode helper records new matches only once", () => {
    const caughtWords = new Set(["alpha"]);
    const result = consumeCatchText(
        caughtWords,
        ["Alpha", "Beta"],
        "alpha beta",
        (text, word) => text.includes(word.toLowerCase()),
    );

    assert.equal(result.changed, true);
    assert.deepEqual(result.caught, ["Beta"]);
    assert.deepEqual([...caughtWords].sort(), ["alpha", "beta"]);

    const duplicate = consumeCatchText(
        caughtWords,
        ["Alpha", "Beta"],
        "alpha beta",
        (text, word) => text.includes(word.toLowerCase()),
    );
    assert.equal(duplicate.changed, false);
    assert.deepEqual(duplicate.caught, []);
});

test("audio utilities compute rms, peaks, trim, and wav header", () => {
    const buffer = makeBuffer([
        [0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0, 0, 0, 0],
    ]);
    assert.ok(computeRms(buffer, 1) > 0.25);
    assert.equal(computePeaks(buffer, 4).length, 4);

    const trimmed = trimSilence(buffer, createMockBuffer, {
        trimRms: 0.1,
        trimPadMs: 0,
        windowSize: 4,
    });
    assert.equal(trimmed.length, 4);

    const wav = encodeWavFromFloat32(Float32Array.from([0, 1, -1]), 1000);
    const view = new DataView(wav);
    assert.equal(String.fromCharCode(...new Uint8Array(wav, 0, 4)), "RIFF");
    assert.equal(view.getUint32(24, true), 1000);
});

test("music manager resumes a changed theme without reloading level three", () => {
    const audioInstances = [];

    class FakeAudio {
        constructor(src = "") {
            this.src = src;
            this.paused = true;
            this.children = [];
            this.listeners = new Map();
            this.playCount = 0;
            this.loadCount = 0;
            audioInstances.push(this);
        }

        addEventListener(type, listener) {
            this.listeners.set(type, listener);
        }

        replaceChildren() {
            this.children = [];
        }

        append(child) {
            this.children.push(child);
        }

        load() {
            this.loadCount += 1;
        }

        play() {
            this.playCount += 1;
            this.paused = false;
        }

        pause() {
            this.paused = true;
        }
    }

    const manager = createMusicManager({
        AudioCtor: FakeAudio,
        documentRef: {
            createElement() {
                return {
                    addEventListener() {},
                };
            },
        },
        windowRef: {},
    });
    const mainTheme = audioInstances[0];

    manager.unlock();
    manager.setMusicLevel(2);
    const level2LoadCount = mainTheme.loadCount;

    assert.equal(mainTheme.playCount, 1);
    assert.deepEqual(
        mainTheme.children.map((source) => source.src),
        [
            "assets/audio/level_2_theme.ogg",
            "assets/audio/level_2_theme.mp3",
            "assets/audio/main_sound_theme.ogg",
            "assets/audio/main_sound_theme.mp3",
        ],
    );

    manager.setMusicLevel(3);
    assert.equal(mainTheme.loadCount, level2LoadCount);
});

test("segment recorder wraps MediaRecorder lifecycle", () => {
    let createdRecorder = null;
    let stopped = null;

    class FakeBlob {
        constructor(chunks, options) {
            this.chunks = chunks;
            this.type = options?.type || "";
            this.size = chunks.reduce((total, chunk) => total + chunk.size, 0);
        }
    }

    class FakeRecorder {
        constructor(stream, options) {
            this.stream = stream;
            this.options = options;
            this.state = "inactive";
            createdRecorder = this;
        }

        start() {
            this.state = "recording";
        }

        stop() {
            this.state = "inactive";
            this.onstop();
        }
    }

    const segment = startSegmentRecorder({
        stream: { id: "mic" },
        mimeType: "audio/webm",
        MediaRecorderClass: FakeRecorder,
        BlobClass: FakeBlob,
        discardFlag: "_discard",
        labelField: "_label",
        defaultLabel: "fallback",
        now: () => 1000,
        onStop(result) {
            stopped = result;
        },
    });

    assert.equal(segment.recorder, createdRecorder);
    assert.equal(createdRecorder.options.mimeType, "audio/webm");
    createdRecorder.ondataavailable({ data: { size: 3 } });
    createdRecorder._label = "sample";
    createdRecorder.stop();
    assert.equal(stopped.label, "sample");
    assert.equal(stopped.durationMs, 0);
    assert.equal(stopped.blob.size, 3);

    stopped = null;
    const discardSegment = startSegmentRecorder({
        stream: {},
        MediaRecorderClass: FakeRecorder,
        BlobClass: FakeBlob,
        discardFlag: "_discard",
        labelField: "_label",
        now: () => 1,
        onStop(result) {
            stopped = result;
        },
    });
    discardRecorder(discardSegment.recorder, "_discard");
    assert.equal(stopped, null);
});

test("readConfig normalizes numeric and text settings", () => {
    const refs = {
        modeInput: { value: "lives" },
        secondsInput: { value: "0" },
        livesInput: { value: "4" },
        retriesInput: { value: "" },
        transcriptSourceInput: { value: "interim" },
        sentenceFuzzyMatchInput: { value: "120" },
        continuePhraseInput: { value: "   " },
        echoModeInput: { value: "both" },
        talkbackEnabledInput: { checked: true },
        talkbackEndpointInput: { value: "http://127.0.0.1:8000///" },
        talkbackThresholdInput: { value: "0" },
        wordsInput: { value: "# Level\nAlpha" },
    };

    const config = readConfig(refs);
    assert.equal(config.seconds, 8);
    assert.equal(config.lives, 4);
    assert.equal(config.retries, 0);
    assert.equal(config.sentenceFuzzyThreshold, 1);
    assert.equal(config.continuePhrase, "I'll be back");
    assert.equal(config.talkbackEndpoint, "http://127.0.0.1:8000");
    assert.equal(config.talkbackThreshold, 4);
});

test("control bindings wire settings events to app callbacks", () => {
    const refs = createControlBindingRefs();
    const win = createEventTarget();
    const calls = [];
    const handlers = {
        persistScript: () => {},
        resetScriptToFile: () => calls.push("resetScript"),
        resetSequence: () => calls.push("reset"),
        getMode: () => "catch",
        rebuildCatchWordsFromSource: () => calls.push("rebuildCatch"),
        renderWordList: () => calls.push("renderWords"),
        renderTranscript: () => calls.push("renderTranscript"),
        restartSequenceIfListening: () => calls.push("restart"),
        shouldRestartTimerOnSecondsChange: () => true,
        startSequenceTimer: () => calls.push("timer"),
        renderSequenceStatus: () => calls.push("status"),
        processSelectedTranscriptText: () => calls.push("processSelected"),
        renderGameOverScreen: () => calls.push("gameOver"),
        echoEnabled: () => false,
        stopEchoSystem: () => calls.push("stopEcho"),
        getMicStream: () => null,
        echoIsRecording: () => false,
        startEchoSystem: () => calls.push("startEcho"),
        talkbackEnabled: () => false,
        stopTalkbackCaptureSystem: () => calls.push("stopTalkback"),
        startTalkbackCaptureSystem: () => calls.push("startTalkback"),
        checkTalkbackHealth: () => calls.push("talkbackHealth"),
        renderTalkbackPanel: () => calls.push("talkbackPanel"),
        resetTalkbackEndpoint: () => calls.push("talkbackReset"),
        markTalkbackEndpointChecking: () => calls.push("talkbackChecking"),
        maybeTriggerTalkback: (kind) => calls.push(`talkback:${kind}`),
        openSettings: () => calls.push("openSettings"),
        closeSettings: () => calls.push("closeSettings"),
    };

    bindControlEvents({ refs, win, handlers });

    refs.wordsInput.dispatch("input");
    assert.deepEqual(calls.splice(0), [
        "reset",
        "rebuildCatch",
        "renderWords",
        "renderTranscript",
        "restart",
    ]);

    refs.secondsInput.dispatch("input");
    assert.deepEqual(calls.splice(0), ["timer", "status"]);

    refs.echoModeInput.dispatch("change");
    assert.deepEqual(calls.splice(0), ["stopEcho"]);

    refs.talkbackThresholdInput.dispatch("input");
    assert.deepEqual(calls.splice(0), ["talkbackPanel", "talkback:random"]);

    win.dispatch("resize");
    assert.deepEqual(calls.splice(0), ["status"]);
});

test("action bindings wire onboarding and dev shortcuts", () => {
    const refs = createActionBindingRefs();
    const doc = createEventTarget();
    const calls = [];
    const handlers = {
        startGame: () => calls.push("startGame"),
        stopSpeech: () => calls.push("stopSpeech"),
        clearTranscript: () => calls.push("clearTranscript"),
        clearEchoSnippets: () => calls.push("clearEcho"),
        clearTalkback: () => calls.push("clearTalkback"),
        resetSequence: () => calls.push("reset"),
        restartSequenceIfListening: () => calls.push("restart"),
        startGameFromOnboarding: () => calls.push("startOnboarding"),
        jumpToLevel: (level) => calls.push(`jump:${level}`),
        gameStarted: () => false,
        onboardingVisible: () => true,
        devMode: () => true,
        isEditingTarget: (target) => target?.editing === true,
        debugCompleteCurrentPhrase: () => calls.push("debugPhrase"),
        debugCompleteLevel1: () => calls.push("debugLevel1"),
    };

    bindActionEvents({ refs, doc, handlers });

    refs.startButton.dispatch("click");
    refs.stopButton.dispatch("click");
    refs.clearButton.dispatch("click");
    assert.deepEqual(calls.splice(0), [
        "startGame",
        "stopSpeech",
        "clearTranscript",
        "clearEcho",
        "clearTalkback",
        "reset",
        "restart",
    ]);

    refs.onboardingAction.dispatch("click");
    assert.deepEqual(calls.splice(0), ["startOnboarding"]);

    doc.dispatch("keydown", { key: "2", target: {} });
    assert.deepEqual(calls.splice(0), ["jump:2"]);

    let prevented = false;
    doc.dispatch("keydown", {
        key: "Enter",
        preventDefault() {
            prevented = true;
        },
    });
    assert.equal(prevented, true);
    assert.deepEqual(calls.splice(0), ["startOnboarding"]);

    doc.dispatch("keydown", { key: "]", target: { editing: true } });
    assert.deepEqual(calls.splice(0), []);

    doc.dispatch("keydown", { key: "l", target: {} });
    assert.deepEqual(calls.splice(0), ["debugLevel1"]);
});

test("level intro controller drives overlay lifecycle", () => {
    const levelIntro = createElementFake();
    const levelIntroTitle = createElementFake();
    const levelIntroSubtitle = createElementFake();
    const timers = [];
    const cleared = [];
    const calls = [];
    let nextTimer = 1;
    const controller = createLevelIntroController({
        levelIntro,
        levelIntroTitle,
        levelIntroSubtitle,
        introDurationMs: 1800,
        exitDurationMs: 420,
        setTimer(callback, delay) {
            const id = nextTimer;
            nextTimer += 1;
            timers.push({ id, callback, delay });
            return id;
        },
        clearTimer(id) {
            cleared.push(id);
        },
        onRender() {
            calls.push("render");
        },
        onComplete() {
            calls.push("complete");
        },
    });

    controller.show({ name: "Level 2", subtitle: "UNDERSEA CABLE" });
    assert.equal(levelIntroTitle.textContent, "LEVEL 2");
    assert.equal(levelIntroSubtitle.textContent, "");
    assert.deepEqual(levelIntro.classList.values(), ["visible"]);
    assert.equal(levelIntro.attributes["aria-hidden"], "false");
    assert.equal(timers[0].delay, 1480);
    assert.deepEqual(calls, ["render"]);

    timers.shift().callback();
    assert.deepEqual(levelIntro.classList.values(), ["leaving", "visible"]);
    assert.equal(timers[0].delay, 420);

    timers.shift().callback();
    assert.equal(levelIntroTitle.textContent, "UNDERSEA CABLE");
    assert.equal(levelIntroSubtitle.textContent, "");
    assert.deepEqual(levelIntro.classList.values(), [
        "level-intro--message",
        "visible",
    ]);
    assert.equal(levelIntro.attributes["aria-hidden"], "false");
    assert.deepEqual(calls, ["render", "render"]);

    timers.shift().callback();
    assert.deepEqual(levelIntro.classList.values(), [
        "leaving",
        "level-intro--message",
        "visible",
    ]);

    timers.shift().callback();
    assert.deepEqual(levelIntro.classList.values(), []);
    assert.equal(levelIntro.attributes["aria-hidden"], "true");
    assert.deepEqual(calls, ["render", "render", "complete"]);

    controller.show({ name: "Level 1", subtitle: "BORDER" });
    controller.clear();
    assert.deepEqual(cleared, [5]);
    assert.equal(levelIntro.attributes["aria-hidden"], "true");
});

test("renderer helpers compute road metrics and collision", () => {
    const metrics = getRoadMetricsFromViewport({
        viewportWidth: 1000,
        viewportHeight: 700,
        charWidth: 10,
        lineHeight: 20,
    });
    assert.ok(metrics.width >= 42);
    assert.ok(metrics.height >= 24);
    assert.ok(metrics.laneLeft < metrics.laneRight);
    assert.equal(
        obstacleIntersectsPlayer({
            wallRow: 10,
            wallHeight: 15,
            playerBounds: { top: 20 },
        }),
        true,
    );
    assert.equal(
        obstacleIntersectsPlayer({
            wallRow: 1,
            wallHeight: 5,
            playerBounds: { top: 20 },
        }),
        false,
    );
});

test("road scene helpers compute wall bounds, fire frames, and cable rows", () => {
    const bounds = getWallBounds("PASSPHRASE", 10, 90);
    assert.ok(bounds.wallLeft >= 10);
    assert.ok(bounds.wallRight <= 90);
    assert.ok(bounds.wallRight - bounds.wallLeft + 1 >= "PASSPHRASE".length);
    assert.equal(WALL_HEIGHT, 15);

    const frames = createScaryFireFrames(20, 1000);
    assert.equal(frames.length, 3);
    assert.equal(frames[0].length, 4);
    assert.equal(frames[0].every((line) => line.length === 20), true);

    const row = Array(30).fill("x");
    renderLevel2CableRoad(row, 0, { laneLeft: 10, laneRight: 18 }, 0);
    assert.equal(row.slice(8, 21).some((char) => char !== "x"), true);
});

test("road renderer builds stable rows with player and obstacle content", () => {
    const metrics = {
        width: 80,
        height: 32,
        laneLeft: 20,
        laneRight: 60,
        carRow: 24,
    };
    const rows = buildRoadRows({
        word: "Alpha",
        wallRow: 0,
        metrics,
        environment: "bubble-wall",
        playerState: {
            state: "idle",
            distortion: 0,
            signalUntil: 0,
        },
        now: 1000,
    });

    assert.equal(rows.length, metrics.height);
    assert.equal(rows.every((row) => row.length === metrics.width), true);
    assert.equal(rows.join("\n").includes("A L P H A"), true);
    assert.equal(rows.join("\n").includes("○"), true);
    assert.equal(rows.join("\n").includes("\\_\"-,__ _/"), true);
});

test("road renderer draws distinct chain-link and firewall environments", () => {
    const metrics = {
        width: 80,
        height: 32,
        laneLeft: 20,
        laneRight: 60,
        carRow: 24,
    };
    const chainRows = buildRoadRows({
        word: "Monkey",
        wallRow: 0,
        metrics,
        environment: "chain-link",
        playerState: { state: "idle", distortion: 0, signalUntil: 0 },
        now: 1000,
    });
    const firewallRows = buildRoadRows({
        word: "Monkey",
        wallRow: 0,
        metrics,
        environment: "voice-firewall",
        playerState: { state: "idle", distortion: 0, signalUntil: 0 },
        now: 1000,
    });
    assert.equal(chainRows.join("\n").includes("@-@-@"), true);
    assert.equal(firewallRows.join("\n").includes("==="), true);
    assert.equal(firewallRows.join("\n").includes("\\_\"-,__ _/"), true);
    assert.equal(firewallRows.join("\n").includes("PVV1234"), false);
    assert.equal(firewallRows.join("\n").includes("PASSPORT"), false);
});

test("road renderer wraps long wall labels inside shared bounds", () => {
    const metrics = {
        width: 84,
        height: 32,
        laneLeft: 20,
        laneRight: 62,
        carRow: 24,
    };
    const phrase =
        "ACCEPT CHANGES TO TERMS AND CONDITIONS BEFORE SYSTEM ACCESS";
    const bounds = getWallBounds(phrase, metrics.laneLeft, metrics.laneRight);
    const lines = formatWallLabelLines(phrase, bounds);

    assert.equal(lines.length, 2);
    assert.equal(
        lines.every((line) => line.length <= bounds.wallRight - bounds.wallLeft - 3),
        true,
    );

    const rows = buildRoadRows({
        word: phrase,
        wallRow: 0,
        metrics,
        environment: "voice-firewall",
        playerState: { state: "idle", distortion: 0, signalUntil: 0 },
        now: 1000,
    });
    const wallRows = rows.slice(0, WALL_HEIGHT);

    assert.equal(wallRows.some((row) => row.includes("ACCEPT CHANGES")), true);
    assert.equal(wallRows.some((row) => row.includes("SYSTEM")), true);
    assert.equal(wallRows.every((row) => row.length === metrics.width), true);
});

test("road animation throttles render frames and cancels cleanly", () => {
    const scheduled = [];
    const canceled = [];
    const renders = [];
    let nextId = 1;
    const animation = createRoadAnimation({
        frameMs: 90,
        render(timestamp) {
            renders.push(timestamp);
        },
        requestFrame(callback) {
            const id = nextId;
            nextId += 1;
            scheduled.push({ id, callback });
            return id;
        },
        cancelFrame(id) {
            canceled.push(id);
        },
    });

    animation.start();
    animation.start();
    assert.equal(scheduled.length, 1);
    scheduled.shift().callback(50);
    assert.deepEqual(renders, []);
    scheduled.shift().callback(100);
    assert.deepEqual(renders, [100]);

    animation.reset();
    scheduled.shift().callback(100);
    assert.deepEqual(renders, [100, 100]);

    animation.stop();
    assert.equal(canceled.length, 1);
    assert.equal(animation.isRunning(), false);
});

test("timeline render state covers catch, active, failed, and complete modes", () => {
    const metrics = {
        carRow: 24,
    };

    assert.deepEqual(
        createTimelineRenderState({
            levelTransitionActive: false,
            sequenceMode: false,
            mode: "catch",
            deadline: null,
            secondsLimit: 5,
            now: 1000,
            metrics,
            words: ["Alpha"],
            currentWordIndex: 0,
            sequenceFailed: false,
            wordCaughtThisBeat: false,
            gateOpenedAt: 0,
            gateAnimationMs: 500,
            beatMode: false,
        }),
        {
            timelineText: "mode: catch",
            timerText: "--.-",
            road: { word: null, wallRow: -10, gateProgress: null },
            checkCollision: false,
        },
    );

    const active = createTimelineRenderState({
        levelTransitionActive: false,
        sequenceMode: true,
        mode: "lives",
        deadline: 3000,
        secondsLimit: 5,
        now: 1000,
        metrics,
        words: ["Alpha", "Beta"],
        currentWordIndex: 0,
        sequenceFailed: false,
        wordCaughtThisBeat: true,
        gateOpenedAt: 750,
        gateAnimationMs: 500,
        beatMode: true,
    });
    assert.equal(active.timelineText, "mode: lives 0/2");
    assert.equal(active.timerText, "✓ 2.0");
    assert.equal(active.road.word, "Alpha");
    assert.equal(active.road.gateProgress, 0.5);
    assert.equal(active.checkCollision, true);

    const beforeSuccessClamp = createTimelineRenderState({
        levelTransitionActive: false,
        sequenceMode: true,
        mode: "lives",
        deadline: 9000,
        wordStartedAt: 1000,
        secondsLimit: 8,
        now: 3000,
        metrics,
        words: ["Alpha"],
        currentWordIndex: 0,
        sequenceFailed: false,
        wordCaughtThisBeat: false,
        gateOpenedAt: 0,
        gateAnimationMs: 500,
        beatMode: true,
    });
    const afterSuccessClamp = createTimelineRenderState({
        levelTransitionActive: false,
        sequenceMode: true,
        mode: "lives",
        deadline: 5000,
        wordStartedAt: 1000,
        secondsLimit: 8,
        now: 3000,
        metrics,
        words: ["Alpha"],
        currentWordIndex: 0,
        sequenceFailed: false,
        wordCaughtThisBeat: true,
        gateOpenedAt: 3000,
        gateAnimationMs: 500,
        beatMode: true,
    });
    assert.equal(afterSuccessClamp.road.wallRow, beforeSuccessClamp.road.wallRow);

    const failed = createTimelineRenderState({
        levelTransitionActive: false,
        sequenceMode: true,
        mode: "ordered",
        deadline: 3000,
        secondsLimit: 5,
        now: 1000,
        metrics,
        words: ["Alpha"],
        currentWordIndex: 0,
        sequenceFailed: true,
        wordCaughtThisBeat: false,
        gateOpenedAt: 0,
        gateAnimationMs: 500,
        beatMode: false,
    });
    assert.equal(failed.timerText, "00.0");
    assert.equal(failed.road.wallRow, 22);
    assert.equal(failed.checkCollision, false);

    const complete = createTimelineRenderState({
        levelTransitionActive: false,
        sequenceMode: true,
        mode: "ordered",
        deadline: null,
        secondsLimit: 5,
        now: 1000,
        metrics,
        words: ["Alpha"],
        currentWordIndex: 1,
        sequenceFailed: false,
        wordCaughtThisBeat: false,
        gateOpenedAt: 0,
        gateAnimationMs: 500,
        beatMode: false,
    });
    assert.equal(complete.timerText, "DONE");
    assert.deepEqual(complete.road, {
        word: null,
        wallRow: -10,
        gateProgress: null,
    });
});

test("player renderer exposes bounds, art, and class names", () => {
    const metrics = {
        width: 80,
        height: 40,
        laneLeft: 20,
        laneRight: 60,
        carRow: 28,
    };
    const passportBounds = getPlayerBounds(metrics, "border-fence");
    const passwordBounds = getPlayerBounds(metrics, "undersea-cable");
    assert.equal(passportBounds.width, passwordBounds.width);
    assert.equal(passportBounds.height, passwordBounds.height);
    assert.ok(passportBounds.top < passportBounds.bottom);

    const passportLines = createPlayerLines({
        environment: "border-fence",
        state: "idle",
        distortion: 0,
        now: 0,
    });
    const passwordLines = createPlayerLines({
        environment: "undersea-cable",
        state: "broken",
        distortion: 0.4,
        now: 0,
    });
    assert.equal(passportLines.length, 14);
    assert.equal(passwordLines.length, 14);
    assert.equal(passportLines[0].trim(), "^");
    assert.ok(passportLines.some((line) => line.includes('"-,')));
    assert.deepEqual(
        createPlayerLines({
            environment: "border-fence",
            state: "idle",
            distortion: 0,
            now: 0,
        }),
        createPlayerLines({
            environment: "undersea-cable",
            state: "idle",
            distortion: 0,
            now: 0,
        }),
    );

    assert.equal(
        getPlayerCharClass({
            char: "^",
            rowIndex: passportBounds.top,
            col: passportBounds.left + 8,
            metrics,
            environment: "border-fence",
            state: "idle",
            signalUntil: 0,
            now: 100,
        }),
        "passport-character passport-character--idle unicode-player unicode-player-iridescent unicode-gleam-6",
    );

    assert.equal(
        getPlayerCharClass({
            char: ":",
            rowIndex: passportBounds.top,
            col: passportBounds.left,
            metrics,
            environment: "border-fence",
            state: "idle",
            signalUntil: 0,
            now: 100,
        }),
        "player-background-dim",
    );
});

test("keygen character state expires and exposes render snapshots", () => {
    let now = 1000;
    const keygen = createKeygenCharacter({ now: () => now });
    keygen.triggerVoiceSignal("success");

    assert.deepEqual(keygen.getRenderState(), {
        state: "success",
        distortion: 0,
        signalUntil: 1760,
    });

    now = 2000;
    assert.equal(keygen.getRenderState().state, "idle");

    keygen.setDistortion(0.5);
    keygen.triggerCollisionFail();
    assert.deepEqual(keygen.getRenderState(), {
        state: "broken",
        distortion: 0.5,
        signalUntil: 0,
    });

    keygen.reset();
    assert.deepEqual(keygen.getRenderState(), {
        state: "idle",
        distortion: 0.5,
        signalUntil: 0,
    });
});

test("ascii waveform helper returns stable dimensions and broken glitches", () => {
    const waveform = generateAsciiWaveform(12, 5, 0.7, 1234, "ambient");
    const rows = waveform.split("\n");
    assert.equal(rows.length, 5);
    assert.equal(rows.every((row) => row.length === 12), true);

    const broken = generateAsciiWaveform(24, 7, 0.9, 2000, "broken");
    assert.equal(broken.split("\n").length, 7);
    assert.match(broken, /[_.x0#-]/);
});

test("microphone visualizer computes normalized waveform amplitude", () => {
    assert.equal(getWaveformAmplitude(Uint8Array.from([128, 128, 128])), 0);
    assert.ok(getWaveformAmplitude(Uint8Array.from([0, 255, 128])) > 0.9);
});

test("microphone visualizer unlocks one shared audio context", () => {
    let contextCount = 0;
    let resumeCount = 0;

    class FakeAudioContext {
        constructor() {
            contextCount += 1;
        }

        resume() {
            resumeCount += 1;
            return Promise.resolve();
        }
    }

    const visualizer = createMicrophoneVisualizer({
        navigatorRef: {},
        AudioContextClass: FakeAudioContext,
        requestFrame: () => 1,
        cancelFrame: () => {},
        performanceRef: { now: () => 0 },
        onAmplitude: () => {},
        onIdleFrame: () => {},
    });

    const first = visualizer.unlockAudio();
    const second = visualizer.unlockAudio();

    assert.equal(first, second);
    assert.equal(contextCount, 1);
    assert.equal(resumeCount, 2);
});

test("memory phrase enemy helpers scale count and create matrix fragments", () => {
    assert.equal(getMemoryPhraseEnemyTargetCount(0), 6);
    assert.equal(getMemoryPhraseEnemyTargetCount(100), 28);

    const fragment = createLevel2MatrixFragment(
        16,
        DEFAULT_MEMORY_PHRASE_ENEMY_CONFIG.matrixSymbols,
    );
    assert.equal(fragment.length, 16);
    assert.match(fragment, /^[A-Z0-9#@%/\\|_=+~^]+$/);
});

test("echo fx bus creates a stereo reverb impulse", () => {
    const channelData = [];
    const audioContext = {
        sampleRate: 1000,
        createBuffer(channels, length, sampleRate) {
            return {
                numberOfChannels: channels,
                length,
                sampleRate,
                getChannelData(channel) {
                    if (!channelData[channel]) {
                        channelData[channel] = new Float32Array(length);
                    }

                    return channelData[channel];
                },
            };
        },
    };

    const impulse = buildReverbImpulse(audioContext, {
        seconds: 0.5,
        random: () => 0.75,
    });
    assert.equal(impulse.numberOfChannels, 2);
    assert.equal(impulse.length, 500);
    assert.equal(impulse.sampleRate, 1000);
    assert.ok(channelData[0][0] > channelData[0].at(-1));
});

test("echo and talkback default configs expose runtime tuning", () => {
    assert.equal(AUDIO_MIX_CONFIG.musicVolume, 0.25);
    assert.equal(AUDIO_MIX_CONFIG.musicDuckedVolume, 0.06);
    assert.equal(AUDIO_MIX_CONFIG.sfxVolume, 0.32);
    assert.equal(ECHO_RUNTIME_CONFIG.gain, 0.45);
    assert.equal(ECHO_RUNTIME_CONFIG.probabilities.life, 0.85);
    assert.equal(TALKBACK_RUNTIME_CONFIG.modelId, "qwen3-tts-0.6b-base");
    assert.equal(TALKBACK_RUNTIME_CONFIG.probabilities.random, 0.12);
    assert.equal(
        getTalkbackTriggerProbability(
            TALKBACK_RUNTIME_CONFIG.probabilities,
            "beat",
            2.5,
        ),
        0.5,
    );
    assert.equal(
        getTalkbackTriggerProbability(
            TALKBACK_RUNTIME_CONFIG.probabilities,
            "life",
            4,
        ),
        1,
    );
    assert.equal(
        getTalkbackTriggerProbability(
            TALKBACK_RUNTIME_CONFIG.probabilities,
            "random",
            0,
        ),
        0,
    );

    const MediaRecorderClass = {
        isTypeSupported(type) {
            return type === "audio/webm;codecs=opus";
        },
    };
    assert.equal(
        getPreferredEchoMimeType(MediaRecorderClass),
        "audio/webm;codecs=opus",
    );
    assert.equal(getPreferredEchoMimeType(null), "");
});

test("talkback generation cache isolates endpoints and evicts least recent", () => {
    const cache = createTalkbackGenerationCache(2);

    cache.set("https://one.example", "model", "first", "/audio/first.wav");
    cache.set("https://one.example", "model", "second", "/audio/second.wav");
    assert.equal(
        cache.get("https://one.example", "model", "first"),
        "/audio/first.wav",
    );

    cache.set("https://one.example", "model", "third", "/audio/third.wav");
    assert.equal(cache.get("https://one.example", "model", "second"), null);
    assert.equal(cache.get("https://two.example", "model", "first"), null);
    assert.equal(cache.size, 2);

    cache.clear();
    assert.equal(cache.size, 0);
});

test("talkback endpoint defaults follow the deployment origin", () => {
    assert.equal(
        getDefaultTalkbackEndpoint({
            protocol: "https:",
            hostname: "passphrase.fun",
            pathname: "/",
        }),
        DEPLOYED_TALKBACK_ENDPOINT,
    );
    assert.equal(
        getDefaultTalkbackEndpoint({
            protocol: "https:",
            hostname: "terschure.github.io",
            pathname: "/passphrase/",
        }),
        DEPLOYED_TALKBACK_ENDPOINT,
    );
    assert.equal(
        getDefaultTalkbackEndpoint({
            protocol: "http:",
            hostname: "127.0.0.1",
            pathname: "/",
        }),
        LOCAL_TALKBACK_ENDPOINT,
    );
});

test("echo runtime renders panel state through injected dependencies", () => {
    const header = { textContent: "" };
    const rows = {
        childNodes: ["existing"],
        replaceChildren(...children) {
            this.childNodes = children;
        },
    };
    const panel = {
        classList: {
            add() {},
            remove() {},
        },
    };
    const runtime = createEchoRuntime({
        panel,
        header,
        rows,
        getEnabled: () => false,
        getMode: () => "off",
        getMicStream: () => null,
        getAudioContext: () => null,
        getProgress: () => 0.5,
        getCurrentWord: () => null,
        getFallbackLabel: () => "",
        textHasWord: () => false,
        MediaRecorderClass: null,
        doc: {
            createElement(tagName) {
                return {
                    tagName,
                    append() {},
                    set className(value) {
                        this._className = value;
                    },
                    get className() {
                        return this._className;
                    },
                    textContent: "",
                };
            },
            createTextNode(text) {
                return { text };
            },
        },
    });

    runtime.render();
    assert.equal(header.textContent, "[ echo ] fx 50%");
    assert.deepEqual(rows.childNodes, []);
});

test("echo policy handles modes, rates, snippet filtering, and trigger gating", () => {
    assert.equal(echoAllows("both", "random"), true);
    assert.equal(echoAllows("random", "wall"), false);
    assert.equal(echoAllows("key", "life"), true);
    assert.equal(pickEchoRate(() => 0), 1);
    assert.ok(Math.abs(pickEchoRate(() => 0.5) - 0.775) < 0.0001);
    assert.ok(Math.abs(pickEchoRate(() => 0.75) - 1.3375) < 0.0001);

    const snippet = selectEchoSnippet({
        snippets: [
            { label: "Alpha", state: "idle" },
            { label: "Beta", state: "idle" },
        ],
        currentWord: "Alpha",
        textHasWord: (text, word) => text === word,
        random: () => 0,
    });
    assert.equal(snippet.label, "Beta");

    assert.equal(
        shouldTriggerEcho({
            mode: "both",
            kind: "life",
            progress: 1,
            snippetCount: 1,
            hasMicStream: true,
            now: 10_000,
            lastEchoAt: 0,
            random: () => 0,
        }),
        true,
    );
});

test("talkback helpers build urls and select reference segments", () => {
    assert.equal(
        absolutizeTalkbackAudioUrl("http://127.0.0.1:8000", "/audio/x.wav"),
        "http://127.0.0.1:8000/audio/x.wav",
    );
    assert.equal(
        absolutizeTalkbackAudioUrl(
            "http://127.0.0.1:8000",
            "https://cdn.example/audio.wav",
        ),
        "https://cdn.example/audio.wav",
    );

    assert.equal(
        talkbackUrl("http://127.0.0.1:8000///", "/api/health"),
        "http://127.0.0.1:8000/api/health",
    );

    const long = {
        blob: { id: "long" },
        buffer: makeBuffer([[0, 1]]),
        transcript: "long segment",
        duration: 6,
        createdAt: 2,
    };
    assert.equal(
        selectTalkbackReference({
            segments: [long],
            encodeWavFromBuffers: () => ({ id: "combined" }),
        }).blob.id,
        "long",
    );

    const combined = selectTalkbackReference({
        segments: [
            { ...long, blob: { id: "a" }, duration: 2, createdAt: 1 },
            { ...long, blob: { id: "b" }, duration: 3.5, createdAt: 2 },
        ],
        encodeWavFromBuffers: () => ({ id: "combined" }),
    });
    assert.equal(combined.blob.id, "combined");
    assert.equal(combined.transcript, "long segment long segment");
});

test("talkback runtime encodes references and renders status state", () => {
    class FakeBlob {
        constructor(parts, options) {
            this.parts = parts;
            this.type = options?.type || "";
            this.size = parts.reduce(
                (total, part) => total + (part.byteLength || part.length || 0),
                0,
            );
        }
    }

    const wav = encodeWavFromBuffers(
        [makeBuffer([[0, 1]], 1000), makeBuffer([[0.5, -0.5]], 1000)],
        FakeBlob,
    );
    assert.equal(wav.type, "audio/wav");
    assert.ok(wav.size > 44);

    const endpointStatus = {};
    const referenceStatus = {};
    const voiceStatus = {};
    const lastStatus = {};
    const runtime = createTalkbackRuntime({
        endpointStatus,
        referenceStatus,
        voiceStatus,
        lastStatus,
        getEnabled: () => true,
        getEndpoint: () => "http://127.0.0.1:8000",
        getThreshold: () => 4,
        getPhrases: () => ["hello"],
        getProgress: () => 2,
        getMicStream: () => null,
        getAudioContext: () => null,
        MediaRecorderClass: null,
        AudioClass: class {},
        BlobClass: FakeBlob,
    });

    runtime.render();
    assert.equal(endpointStatus.textContent, "checking");
    assert.equal(referenceStatus.textContent, "0 clips");
    assert.equal(voiceStatus.textContent, "2/4");

    // a specific narrative cue is a safe no-op while the endpoint is not ready
    assert.equal(typeof runtime.triggerSpecific, "function");
    assert.doesNotThrow(() => runtime.triggerSpecific("narrative line"));

    runtime.clear();
    assert.equal(lastStatus.textContent, "cleared");
    assert.equal(lastStatus.className, "talkback-value");
});
