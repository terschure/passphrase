import {
    computePeaks,
    computeRms,
    trimSilence,
} from "../audio/bufferUtils.js";
import {
    discardRecorder,
    startSegmentRecorder,
} from "../audio/segmentRecorder.js";
import {
    createEchoBus,
    disconnectEchoBus,
    updateEchoBus,
} from "./fxBus.js";
import { renderEchoPanel } from "./panel.js";
import {
    echoAllows,
    pickEchoRate,
    selectEchoSnippet,
} from "./policy.js";
import { ECHO_RUNTIME_CONFIG } from "./defaultConfig.js";

export function createEchoRuntime({
    panel,
    header,
    rows,
    getEnabled,
    getMode,
    getMicStream,
    getAudioContext,
    getProgress,
    getCurrentWord,
    getFallbackLabel,
    textHasWord,
    onRandomTick,
    doc = document,
    mimeType = "",
    MediaRecorderClass = MediaRecorder,
    config = {},
    timers = {
        setInterval: (...a) => setInterval(...a),
        clearInterval: (...a) => clearInterval(...a),
        setTimeout: (...a) => setTimeout(...a),
        clearTimeout: (...a) => clearTimeout(...a),
    },
    now = Date.now,
}) {
    const settings = { ...ECHO_RUNTIME_CONFIG, ...config };
    const snippets = [];
    const activeEchoes = new Set();
    let recorder = null;
    let recorderStartedAt = 0;
    let bus = null;
    let lastEchoAt = 0;
    let randomInterval = null;
    let idCounter = 0;

    function render() {
        renderEchoPanel({
            header,
            rows,
            progress: getProgress(),
            recorderActive: Boolean(recorder),
            snippets,
            doc,
        });
    }

    function start() {
        if (!getEnabled() || !getMicStream() || !MediaRecorderClass) {
            return;
        }

        panel.classList.add("visible");
        startSegment();

        if (!randomInterval) {
            randomInterval = timers.setInterval(() => {
                if (recorder && now() - recorderStartedAt > settings.maxMs) {
                    cutSnippet(getFallbackLabel() || "…");
                }

                maybeTrigger("random");
                onRandomTick?.();
                render();
            }, 5000);
        }

        render();
    }

    function stop() {
        cancelActiveEchoes();

        if (bus) {
            disconnectEchoBus(bus);
            bus = null;
        }

        if (randomInterval) {
            timers.clearInterval(randomInterval);
            randomInterval = null;
        }

        if (recorder) {
            discardRecorder(recorder, "_echoDiscard");
            recorder = null;
        }

        panel.classList.remove("visible");
        render();
    }

    function startSegment() {
        if (!getMicStream() || !getEnabled() || !MediaRecorderClass) {
            return;
        }

        const segment = startSegmentRecorder({
            stream: getMicStream(),
            mimeType,
            MediaRecorderClass,
            discardFlag: "_echoDiscard",
            labelField: "_echoLabel",
            defaultLabel: "…",
            now,
            onStop({ blob, label, durationMs }) {
                if (!getAudioContext()) {
                    return;
                }

                finalizeSegment(blob, label, durationMs);
            },
        });

        if (!segment) {
            return;
        }

        recorder = segment.recorder;
        recorderStartedAt = segment.startedAt;
    }

    function cutSnippet(label) {
        if (!recorder || recorder.state !== "recording") {
            return;
        }

        recorder._echoLabel = label;
        recorder.stop();
        recorder = null;
        startSegment();
    }

    async function finalizeSegment(blob, label, durationMs) {
        if (durationMs < settings.minMs || !blob.size) {
            return;
        }

        let buffer;

        try {
            const bytes = await blob.arrayBuffer();
            const context = getAudioContext();

            if (!context) {
                return;
            }

            buffer = await context.decodeAudioData(bytes);
        } catch (error) {
            return;
        }

        const context = getAudioContext();

        if (!context) {
            return;
        }

        buffer = trimSilence(
            buffer,
            (...args) => context.createBuffer(...args),
            {
                trimRms: settings.trimRms,
                trimPadMs: settings.trimPadMs,
            },
        );

        if (
            !buffer ||
            buffer.duration * 1000 < settings.minMs ||
            computeRms(buffer) < settings.minRms
        ) {
            return;
        }

        idCounter += 1;
        snippets.push({
            id: idCounter,
            label,
            buffer,
            peaks: computePeaks(buffer, settings.waveBuckets),
            state: "idle",
        });

        render();
    }

    function ensureBus() {
        const context = getAudioContext();

        if (bus || !context) {
            return bus;
        }

        bus = createEchoBus(context, {
            gain: settings.gain,
            delayTime: settings.delayTime,
            reverbSeconds: settings.reverbSeconds,
        });
        return bus;
    }

    function updateBus(progress) {
        const activeBus = ensureBus();
        const context = getAudioContext();

        if (!activeBus || !context) {
            return;
        }

        updateEchoBus(activeBus, context, progress);
    }

    function maybeTrigger(kind) {
        const progress = getProgress();
        const cooldown =
            settings.cooldownMs *
            (1 - (1 - settings.cooldownFloor) * progress);

        if (
            !getMicStream() ||
            !getEnabled() ||
            !echoAllows(getMode(), kind) ||
            !snippets.length ||
            now() - lastEchoAt < cooldown
        ) {
            return;
        }

        const chance = Math.min(
            1,
            (settings.probabilities[kind] || 0) *
                (1 + settings.progressBoost * progress),
        );

        if (Math.random() >= chance) {
            return;
        }

        initiate(pickSnippet());
    }

    function pickSnippet() {
        return selectEchoSnippet({
            snippets,
            currentWord: getCurrentWord(),
            textHasWord,
        });
    }

    function initiate(snippet) {
        if (!snippet) {
            return;
        }

        lastEchoAt = now();
        snippet.rate = pickEchoRate();
        snippet.state = "initiating";

        const entry = { snippet, source: null, prerollTimer: null };
        entry.prerollTimer = timers.setTimeout(() => {
            entry.prerollTimer = null;
            play(entry);
        }, settings.prerollMs);
        activeEchoes.add(entry);
        render();
    }

    function play(entry) {
        const snippet = entry.snippet;
        const activeBus = ensureBus();
        const context = getAudioContext();

        if (!context || !activeBus) {
            activeEchoes.delete(entry);
            snippet.state = "idle";
            render();
            return;
        }

        context.resume();
        updateBus(getProgress());

        const source = context.createBufferSource();
        source.buffer = snippet.buffer;
        source.playbackRate.value = snippet.rate || 1;
        source.connect(activeBus.input);

        source.onended = () => {
            activeEchoes.delete(entry);
            snippet.state = "idle";
            render();
        };

        snippet.state = "playing";
        entry.source = source;
        source.start();
        render();
    }

    function cancelActiveEchoes() {
        for (const entry of activeEchoes) {
            if (entry.prerollTimer) {
                timers.clearTimeout(entry.prerollTimer);
            }

            if (entry.source) {
                entry.source.onended = null;

                try {
                    entry.source.stop();
                } catch (error) {
                    // already stopped
                }
            }

            entry.snippet.state = "idle";
        }

        activeEchoes.clear();
        render();
    }

    function clearSnippets() {
        cancelActiveEchoes();
        snippets.length = 0;
        render();
    }

    return {
        start,
        stop,
        cutSnippet,
        maybeTrigger,
        render,
        clearSnippets,
        isRecording() {
            return Boolean(recorder);
        },
    };
}
