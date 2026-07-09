import {
    computeRms,
    trimSilence,
    writeAscii,
} from "../audio/bufferUtils.js";
import {
    discardRecorder,
    startSegmentRecorder,
} from "../audio/segmentRecorder.js";
import {
    generateTalkbackAudioRecord,
    playTalkbackAudio,
    uploadTalkbackReference,
} from "./client.js";
import {
    fetchWithTimeout,
    selectTalkbackReference,
    talkbackUrl,
} from "./reference.js";
import {
    renderTalkbackPanel,
    setTalkbackStatus,
} from "./panel.js";
import { TALKBACK_RUNTIME_CONFIG } from "./defaultConfig.js";

export function createTalkbackRuntime({
    endpointStatus,
    referenceStatus,
    voiceStatus,
    lastStatus,
    getEnabled,
    getEndpoint,
    getThreshold,
    getPhrases,
    getProgress,
    getMicStream,
    getAudioContext,
    mimeType = "",
    MediaRecorderClass = MediaRecorder,
    AudioClass = Audio,
    BlobClass = Blob,
    config = {},
    timers = {
        setInterval: (...a) => setInterval(...a),
        clearInterval: (...a) => clearInterval(...a),
    },
    now = Date.now,
}) {
    const settings = { ...TALKBACK_RUNTIME_CONFIG, ...config };
    const segments = [];
    const queue = [];
    let recorder = null;
    let recorderStartedAt = 0;
    let healthInterval = null;
    let ready = false;
    let healthDetail = "checking";
    let reference = null;
    let referenceSignature = "";
    let uploadPromise = null;
    let generatePromise = null;
    let audio = null;
    let lastGeneratedAt = 0;
    let sessionId = 0;

    function render() {
        const selectedReference = getSelectedReference();
        renderTalkbackPanel({
            endpointStatus,
            referenceStatus,
            voiceStatus,
            enabled: getEnabled(),
            ready,
            healthDetail,
            reference,
            selectedReference,
            segmentCount: segments.length,
            threshold: getThreshold(),
            progress: getProgress(),
            generating: Boolean(generatePromise),
            playing: Boolean(audio),
        });
    }

    async function checkHealth() {
        if (!getEnabled() || !getEndpoint()) {
            ready = false;
            healthDetail = getEnabled() ? "no endpoint" : "off";
            render();
            return;
        }

        try {
            const response = await fetchWithTimeout(
                talkbackUrl(getEndpoint(), "/api/health"),
                { cache: "no-store" },
                settings.fetchTimeoutMs,
            );

            if (!response.ok) {
                throw new Error(`health ${response.status}`);
            }

            const health = await response.json();
            ready = Boolean(health.ready);
            healthDetail = ready ? "ready" : "not ready";
        } catch (error) {
            ready = false;
            healthDetail =
                error.name === "AbortError" ? "timeout" : "unavailable";
        }

        render();
    }

    function startHealthChecks() {
        if (healthInterval) {
            timers.clearInterval(healthInterval);
        }

        checkHealth();
        healthInterval = timers.setInterval(checkHealth, 7000);
    }

    function startCapture() {
        if (!getEnabled() || !getMicStream() || !MediaRecorderClass) {
            render();
            return;
        }

        if (!recorder) {
            startSegment();
        }

        render();
    }

    function stopCapture() {
        sessionId += 1;

        if (recorder) {
            discardRecorder(recorder, "_talkbackDiscard");
            recorder = null;
        }

        if (audio) {
            audio.pause();
            audio = null;
        }

        queue.length = 0;
        generatePromise = null;
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
            BlobClass,
            discardFlag: "_talkbackDiscard",
            labelField: "_talkbackLabel",
            now,
            onStop({ blob, label, durationMs }) {
                if (!getAudioContext()) {
                    return;
                }

                finalizeSegment(blob, label, durationMs);
            },
            onStartError() {
                setTalkbackStatus(lastStatus, "record failed", "bad");
            },
        });

        if (!segment) {
            return;
        }

        recorder = segment.recorder;
        recorderStartedAt = segment.startedAt;
    }

    function cutSegment(label) {
        if (!recorder || recorder.state !== "recording") {
            return;
        }

        recorder._talkbackLabel = label;
        recorder.stop();
        recorder = null;
        startSegment();
    }

    async function finalizeSegment(blob, label, durationMs) {
        if (durationMs < settings.minMs || !blob.size || !label.trim()) {
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
            setTalkbackStatus(lastStatus, "decode failed", "bad");
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

        segments.push({
            blob,
            buffer,
            transcript: label.trim(),
            duration: buffer.duration,
            createdAt: now(),
        });

        while (segments.length > settings.maxSegments) {
            segments.shift();
        }

        reference = null;
        referenceSignature = "";
        render();
        maybeTrigger("random");
    }

    function getSelectedReference() {
        return selectTalkbackReference({
            segments,
            minRefSeconds: settings.minRefSeconds,
            targetRefSeconds: settings.targetRefSeconds,
            encodeWavFromBuffers,
        });
    }

    async function ensureReference() {
        const selected = getSelectedReference();

        if (!selected) {
            setTalkbackStatus(lastStatus, "need 5s voice", "warn");
            return null;
        }

        if (reference && referenceSignature === selected.signature) {
            return reference;
        }

        if (uploadPromise) {
            return uploadPromise;
        }

        uploadPromise = (async () => {
            setTalkbackStatus(lastStatus, "uploading ref", "warn");
            const ref = await uploadTalkbackReference({
                selected,
                refsUrl: talkbackUrl(getEndpoint(), "/api/refs"),
                fetchWithTimeout,
                timeoutMs: settings.generateTimeoutMs,
            });
            reference = ref;
            referenceSignature = selected.signature;
            setTalkbackStatus(lastStatus, "ref ready", "ok");
            render();
            return ref;
        })();

        try {
            return await uploadPromise;
        } catch (error) {
            setTalkbackStatus(lastStatus, "ref failed", "bad");
            return null;
        } finally {
            uploadPromise = null;
        }
    }

    function canGenerate() {
        return (
            getEnabled() &&
            ready &&
            getProgress() >= getThreshold() &&
            getPhrases().length > 0
        );
    }

    function maybeTrigger(kind) {
        if (!canGenerate()) {
            render();
            return;
        }

        if (
            generatePromise ||
            audio ||
            now() - lastGeneratedAt < settings.cooldownMs
        ) {
            return;
        }

        const chance =
            settings.probabilities[kind] ||
            settings.probabilities.random ||
            0.1;

        if (Math.random() >= chance) {
            return;
        }

        const phrases = getPhrases();
        const prompt = phrases[Math.floor(Math.random() * phrases.length)];
        queuePrompt(prompt);
    }

    // Fire a specific scripted phrase (a positional narrative cue). It skips the
    // random pool, threshold, probability, and cooldown gates, but still only
    // runs when enabled + endpoint ready, and is queued so it never overlaps or
    // interrupts a phrase already playing.
    function triggerSpecific(prompt) {
        if (!prompt || !getEnabled() || !ready) {
            return;
        }

        queuePrompt(prompt);
    }

    function queuePrompt(prompt) {
        if (!prompt || queue.length > 2) {
            return;
        }

        queue.push(prompt);
        runQueue();
    }

    async function runQueue() {
        if (generatePromise || audio) {
            return;
        }

        const prompt = queue.shift();

        if (!prompt) {
            render();
            return;
        }

        generatePromise = generate(prompt);

        try {
            await generatePromise;
        } finally {
            generatePromise = null;
            render();
        }
    }

    async function generate(prompt) {
        const activeSession = sessionId;

        try {
            const ref = await ensureReference();

            if (!ref || activeSession !== sessionId) {
                return;
            }

            setTalkbackStatus(lastStatus, "generating", "warn");
            render();

            const record = await generateTalkbackAudioRecord({
                generateUrl: talkbackUrl(getEndpoint(), "/api/generate"),
                fetchWithTimeout,
                timeoutMs: settings.generateTimeoutMs,
                modelId: settings.modelId,
                prompt,
                refId: ref.ref_id,
            });

            if (activeSession !== sessionId) {
                return;
            }

            await play(record.audio_url, prompt);
        } catch (error) {
            if (activeSession !== sessionId) {
                return;
            }

            setTalkbackStatus(
                lastStatus,
                error.name === "AbortError"
                    ? "generation timeout"
                    : "generation failed",
                "bad",
            );
        } finally {
            lastGeneratedAt = now();
        }
    }

    function play(audioUrl, prompt) {
        return playTalkbackAudio({
            endpoint: getEndpoint(),
            audioUrl,
            prompt,
            AudioClass,
            onCreated(createdAudio) {
                audio = createdAudio;
            },
            onPlay(_, playingAudio) {
                audio = playingAudio;
                setTalkbackStatus(lastStatus, prompt, "ok");
                render();
            },
            onEnded() {
                audio = null;
                runQueue();
            },
            onError(message) {
                setTalkbackStatus(lastStatus, message, "bad");
                audio = null;
            },
        });
    }

    function resetEndpoint() {
        sessionId += 1;
        ready = false;
        reference = null;
        referenceSignature = "";
    }

    function markEndpointChecking() {
        ready = false;
        healthDetail = "checking";
        render();
    }

    function clear() {
        sessionId += 1;
        segments.length = 0;
        queue.length = 0;
        reference = null;
        referenceSignature = "";

        if (audio) {
            audio.pause();
            audio = null;
        }

        setTalkbackStatus(lastStatus, "cleared");
        render();
    }

    return {
        render,
        checkHealth,
        startHealthChecks,
        startCapture,
        stopCapture,
        cutSegment,
        maybeTrigger,
        triggerSpecific,
        resetEndpoint,
        markEndpointChecking,
        clear,
    };
}

export function encodeWavFromBuffers(buffers, BlobClass = Blob) {
    const sampleRate = buffers[0].sampleRate;
    const gapFrames = Math.round(sampleRate * 0.18);
    const totalFrames = buffers.reduce(
        (total, buffer, index) =>
            total + buffer.length + (index > 0 ? gapFrames : 0),
        0,
    );
    const samples = new Float32Array(totalFrames);
    let offset = 0;

    for (const [index, buffer] of buffers.entries()) {
        if (index > 0) {
            offset += gapFrames;
        }

        samples.set(buffer.getChannelData(0), offset);
        offset += buffer.length;
    }

    const wav = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wav);
    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    for (let i = 0; i < samples.length; i += 1) {
        const value = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(
            44 + i * 2,
            value < 0 ? value * 0x8000 : value * 0x7fff,
            true,
        );
    }

    return new BlobClass([wav], { type: "audio/wav" });
}
