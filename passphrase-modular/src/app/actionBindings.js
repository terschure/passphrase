export function bindActionEvents({ refs, doc = document, handlers }) {
    const {
        onboardingAction,
        startButton,
        stopButton,
        clearButton,
        devLevel1Button,
        devLevel2Button,
    } = refs;

    startButton.addEventListener("click", handlers.startGame);
    stopButton.addEventListener("click", handlers.stopSpeech);

    clearButton.addEventListener("click", () => {
        handlers.clearTranscript();
        handlers.clearEchoSnippets();
        handlers.clearTalkback();
        handlers.resetSequence();
        handlers.restartSequenceIfListening();
    });

    onboardingAction.addEventListener("click", () => {
        handlers.startGameFromOnboarding();
    });

    devLevel1Button.addEventListener("click", () => {
        handlers.jumpToLevel(1);
    });

    devLevel2Button.addEventListener("click", () => {
        handlers.jumpToLevel(2, handlers.shouldMockLevel2Memories());
    });

    doc.addEventListener("keydown", (event) => {
        if (
            event.key === "Enter" &&
            !handlers.gameStarted() &&
            handlers.onboardingVisible()
        ) {
            event.preventDefault();
            handlers.startGameFromOnboarding();
        }
    });

    doc.addEventListener("keydown", (event) => {
        if (!handlers.devMode() || handlers.isEditingTarget(event.target)) {
            return;
        }
        if (event.key === "1") {
            handlers.jumpToLevel(1);
        } else if (event.key === "2") {
            handlers.jumpToLevel(2, handlers.shouldMockLevel2Memories());
        } else if (event.key === "]") {
            handlers.debugCompleteCurrentPhrase();
        } else if (event.key.toLowerCase() === "l") {
            handlers.debugCompleteLevel1();
        }
    });
}
