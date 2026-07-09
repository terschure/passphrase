export function renderGameOverScreen({
    refs,
    sequenceFailed,
    gameOverContinuing,
    isSequenceMode,
    words,
    currentWordIndex,
    continuePhrase,
    updateGameOverFire,
}) {
    if ((!sequenceFailed && !gameOverContinuing) || !isSequenceMode) {
        refs.gameOverScreen.classList.remove("visible");
        refs.gameOverScreen.classList.remove("confirmed");
        return;
    }

    const round = Math.min(currentWordIndex + 1, words.length || 1);
    refs.gameOverTitle.textContent = gameOverContinuing
        ? "phrase accepted"
        : "game over";
    refs.gameOverRound.textContent = `round ${round} of ${words.length || 1}`;
    refs.gameOverCopy.textContent = gameOverContinuing
        ? "Hold tight. Restarting from this round..."
        : "Say the imitation phrase to continue.";
    refs.gameOverPhrase.textContent = gameOverContinuing
        ? "get ready"
        : `"${continuePhrase}"`;
    refs.gameOverScreen.classList.toggle("confirmed", gameOverContinuing);
    refs.gameOverScreen.classList.add("visible");
    updateGameOverFire(true);
}
