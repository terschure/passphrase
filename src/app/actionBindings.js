export function bindActionEvents({ refs, doc = document, handlers }) {
    const { onboardingAction, startButton, stopButton, clearButton } = refs;

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
        if (/^[1-9]$/.test(event.key)) {
            handlers.jumpToLevel(Number(event.key));
        } else if (event.key === "]") {
            handlers.debugCompleteCurrentPhrase();
        } else if (event.key.toLowerCase() === "l") {
            handlers.debugCompleteLevel1();
        }
    });
}
