export function bindControlEvents({ refs, win = window, handlers }) {
    const {
        wordsInput,
        modeInput,
        secondsInput,
        livesInput,
        retriesInput,
        transcriptSourceInput,
        sentenceFuzzyMatchInput,
        continuePhraseInput,
        echoModeInput,
        talkbackEnabledInput,
        talkbackEndpointInput,
        talkbackThresholdInput,
        resetSequenceButton,
        resetScriptButton,
        openSettingsButton,
        closeSettingsButton,
        settingsBackdrop,
    } = refs;

    wordsInput.addEventListener("input", () => {
        handlers.persistScript();
        handlers.resetSequence();
        if (handlers.getMode() === "catch") {
            handlers.rebuildCatchWordsFromSource();
        }
        handlers.renderWordList();
        handlers.renderTranscript();
        handlers.restartSequenceIfListening();
    });

    if (resetScriptButton) {
        resetScriptButton.addEventListener("click", () => {
            handlers.resetScriptToFile();
        });
    }

    modeInput.addEventListener("change", () => {
        handlers.resetSequence();
        handlers.renderTranscript();
        handlers.restartSequenceIfListening();
    });

    secondsInput.addEventListener("input", () => {
        if (handlers.shouldRestartTimerOnSecondsChange()) {
            handlers.startSequenceTimer();
        }
        handlers.renderSequenceStatus();
    });

    livesInput.addEventListener("input", () => {
        handlers.resetSequence();
        handlers.restartSequenceIfListening();
    });

    retriesInput.addEventListener("input", () => {
        handlers.resetSequence();
        handlers.restartSequenceIfListening();
    });

    transcriptSourceInput.addEventListener("change", () => {
        handlers.resetSequence();
        handlers.processSelectedTranscriptText();
        handlers.renderTranscript();
        handlers.renderWordList();
    });

    sentenceFuzzyMatchInput.addEventListener("input", () => {
        handlers.resetSequence();

        if (handlers.getMode() === "catch") {
            handlers.rebuildCatchWordsFromSource();
        } else {
            handlers.processSelectedTranscriptText();
        }

        handlers.renderTranscript();
        handlers.renderWordList();
    });

    continuePhraseInput.addEventListener("input", () => {
        handlers.renderGameOverScreen();
    });

    echoModeInput.addEventListener("change", () => {
        if (!handlers.echoEnabled()) {
            handlers.stopEchoSystem();
            return;
        }

        if (handlers.getMicStream() && !handlers.echoIsRecording()) {
            handlers.startEchoSystem();
        }
    });

    talkbackEnabledInput.addEventListener("change", () => {
        if (!handlers.talkbackEnabled()) {
            handlers.stopTalkbackCaptureSystem();
        } else if (handlers.getMicStream()) {
            handlers.startTalkbackCaptureSystem();
        }

        handlers.checkTalkbackHealth();
        handlers.renderTalkbackPanel();
    });

    talkbackEndpointInput.addEventListener("change", () => {
        handlers.resetTalkbackEndpoint();
        handlers.checkTalkbackHealth();
    });

    talkbackEndpointInput.addEventListener("input", () => {
        handlers.markTalkbackEndpointChecking();
    });

    talkbackThresholdInput.addEventListener("input", () => {
        handlers.renderTalkbackPanel();
        handlers.maybeTriggerTalkback("random");
    });

    resetSequenceButton.addEventListener("click", () => {
        handlers.resetSequence();
        handlers.restartSequenceIfListening();
    });

    openSettingsButton.addEventListener("click", handlers.openSettings);
    closeSettingsButton.addEventListener("click", handlers.closeSettings);
    settingsBackdrop.addEventListener("click", handlers.closeSettings);
    win.addEventListener("resize", handlers.renderSequenceStatus);
}
