import {
    collectFinalChunks,
    collectLiveTranscript,
} from "./recognitionResults.js";

export function createRecognitionResultHandler({
    transcriptState,
    isGameStarted,
    isStartCommand,
    startGameFromVoice,
    getTranscriptSource,
    getMode,
    triggerVoiceSignal,
    processTranscriptText,
    rebuildCatchWordsFromSource,
    renderTranscript,
    renderWordList,
    cutEchoSnippet,
    cutTalkbackSegment,
    log = console.log,
}) {
    return function handleRecognitionResult(event) {
        transcriptState.beginRecognitionResult();

        try {
            const newFinals = collectFinalChunks(event, {
                onText(text) {
                    if (isGameStarted() && text.trim()) {
                        triggerVoiceSignal("speaking");
                    }
                },
                onFinal(chunk) {
                    transcriptState.appendFinal(chunk);
                    log("[voice] transcript:", chunk);

                    if (!isGameStarted() && isStartCommand(chunk)) {
                        startGameFromVoice();
                    }

                    if (isGameStarted() && getTranscriptSource() === "final") {
                        processTranscriptText(chunk);
                    }
                },
                shouldStop: () => transcriptState.wasWipedDuringResult(),
            });

            if (newFinals.length) {
                const finalLabel = newFinals.join(" ");
                cutEchoSnippet(finalLabel);
                cutTalkbackSegment(finalLabel);
            }

            if (!transcriptState.wasWipedDuringResult()) {
                const interimTranscript = collectLiveTranscript(event, {
                    transcriptWasWiped: transcriptState.transcriptWasWiped,
                });
                transcriptState.setInterim(interimTranscript);

                if (interimTranscript) {
                    log("[voice] transcript:", interimTranscript);
                }

                if (!isGameStarted() && isStartCommand(interimTranscript)) {
                    startGameFromVoice();
                }

                if (isGameStarted() && getTranscriptSource() === "interim") {
                    if (getMode() === "catch") {
                        rebuildCatchWordsFromSource();
                    } else {
                        processTranscriptText(interimTranscript);
                    }
                }
            }

            renderTranscript();
            renderWordList();
        } finally {
            transcriptState.endRecognitionResult();
        }
    };
}

export function createSpeechServiceCallbacks({
    recognitionState,
    status,
    startButton,
    stopButton,
    interimText,
    isGameStarted,
    isOnboardingVoiceBlocked,
    setOnboardingVoiceBlocked,
    scheduleOnboardingRestart,
    triggerVoiceSignal,
    startRoadAnimation,
    shouldStartSequenceTimer,
    startSequenceTimer,
    stopEchoSystem,
    stopTalkbackCaptureSystem,
    stopVisualizer,
    drawIdleVisualizer,
    onResult,
    log = console.log,
    warn = console.warn,
}) {
    return {
        onStart() {
            recognitionState.starting = false;
            recognitionState.listening = true;
            log("[voice] recognition started");

            if (!isGameStarted()) {
                status.textContent = "Listening for START...";
                return;
            }

            status.textContent = "Listening...";
            triggerVoiceSignal("speaking");
            startButton.disabled = true;
            stopButton.disabled = false;
            startRoadAnimation();

            if (shouldStartSequenceTimer()) {
                startSequenceTimer();
            }
        },
        onEnd() {
            recognitionState.starting = false;
            recognitionState.listening = false;

            if (!isGameStarted()) {
                status.textContent = "Voice start idle";
                if (!isOnboardingVoiceBlocked()) {
                    scheduleOnboardingRestart?.();
                }
                return;
            }

            status.textContent = "Stopped";
            startButton.disabled = false;
            stopButton.disabled = true;
            interimText.textContent = "";
            stopEchoSystem();
            stopTalkbackCaptureSystem();
            stopVisualizer();
            drawIdleVisualizer();
        },
        onError(event) {
            recognitionState.starting = false;
            status.textContent = `Error: ${event.error}`;
            warn("[voice] recognition error:", event.error);
            if (
                event.error === "not-allowed" ||
                event.error === "service-not-allowed"
            ) {
                setOnboardingVoiceBlocked(true);
            }
        },
        onResult,
        onStartError(error) {
            recognitionState.starting = false;
            warn("[voice] recognition could not start", error);
        },
    };
}
