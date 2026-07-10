export const AUTO_PASS_GAME_OVER_THRESHOLD = 2;
export const CAUGHT_BEAT_ADVANCE_DELAY_MS = 2000;

export function getCaughtBeatDeadline(
    currentDeadline,
    caughtAt,
    maximumDelayMs = CAUGHT_BEAT_ADVANCE_DELAY_MS,
) {
    const caughtDeadline = caughtAt + maximumDelayMs;
    return currentDeadline
        ? Math.min(currentDeadline, caughtDeadline)
        : caughtDeadline;
}

export function recordWordGameOver(gameOverCounts, wordIndex) {
    const count = (gameOverCounts.get(wordIndex) || 0) + 1;
    gameOverCounts.set(wordIndex, count);
    return count;
}

export function shouldAutoPassWord(
    gameOverCounts,
    wordIndex,
    threshold = AUTO_PASS_GAME_OVER_THRESHOLD,
) {
    return (gameOverCounts.get(wordIndex) || 0) >= threshold;
}

export function clearWordGameOverCounts(gameOverCounts) {
    gameOverCounts.clear();
}

export function createInitialGameState({
    currentLevel = 1,
    currentWordIndex = 0,
    lives = 3,
    retries = 2,
    caughtWords = [],
    completedPhrasesFromLevel1 = [],
} = {}) {
    return {
        currentLevel,
        currentWordIndex,
        caughtWords: new Set(caughtWords),
        completedPhrasesFromLevel1: [...completedPhrasesFromLevel1],
        sequenceFailed: false,
        failReason: "timeout",
        livesLeft: lives,
        retriesLeft: retries,
        wordCaughtThisBeat: false,
        levelTransitionRequested: false,
    };
}

export function isBeatMode(mode) {
    return mode === "rhythm" || mode === "lives";
}

export function recordCompletedPhrase(state, phrase) {
    if (
        state.currentLevel === 1 &&
        phrase &&
        !state.completedPhrasesFromLevel1.includes(phrase)
    ) {
        state.completedPhrasesFromLevel1.push(phrase);
    }
}

export function markCurrentWordCaught(state, words, mode) {
    if (state.sequenceFailed || state.currentWordIndex >= words.length) {
        return { changed: false, completed: false };
    }

    const phrase = words[state.currentWordIndex];
    state.caughtWords.add(phrase.toLowerCase());

    if (isBeatMode(mode)) {
        if (state.wordCaughtThisBeat) {
            return { changed: false, completed: false };
        }
        state.wordCaughtThisBeat = true;
        return { changed: true, completed: false };
    }

    recordCompletedPhrase(state, phrase);
    state.currentWordIndex += 1;
    return {
        changed: true,
        completed: state.currentWordIndex >= words.length,
    };
}

export function failSequence(state, reason = "timeout") {
    state.sequenceFailed = true;
    state.failReason = reason;
    state.wordCaughtThisBeat = false;
}

export function handleBeatDeadline(
    state,
    words,
    { mode = "lives", livesLimit = 3, retriesLimit = 2 } = {},
) {
    if (!isBeatMode(mode)) {
        failSequence(state, "timeout");
        return { outcome: "failed" };
    }

    if (state.wordCaughtThisBeat) {
        const phrase = words[state.currentWordIndex];
        recordCompletedPhrase(state, phrase);
        state.currentWordIndex += 1;
        state.wordCaughtThisBeat = false;
        state.livesLeft = livesLimit;
        state.retriesLeft = retriesLimit;

        return {
            outcome:
                state.currentWordIndex >= words.length
                    ? "completed"
                    : "advanced",
        };
    }

    if (mode === "rhythm") {
        failSequence(state, "missed the beat");
        return { outcome: "failed" };
    }

    state.livesLeft -= 1;

    if (state.livesLeft <= 0) {
        failSequence(state, "out of lives");
        return { outcome: "failed" };
    }

    if (state.retriesLeft > 0) {
        state.retriesLeft -= 1;
        return { outcome: "life-lost" };
    }

    state.currentWordIndex += 1;
    state.retriesLeft = retriesLimit;

    return {
        outcome:
            state.currentWordIndex >= words.length ? "completed" : "skipped",
    };
}

export function acceptContinuePhrase(state, { livesLimit = 3, retriesLimit = 2 } = {}) {
    if (!state.sequenceFailed) {
        return false;
    }

    state.sequenceFailed = false;
    state.failReason = "timeout";
    state.livesLeft = livesLimit;
    state.retriesLeft = retriesLimit;
    state.wordCaughtThisBeat = false;
    return true;
}

export function resetSequence(state, { livesLimit = 3, retriesLimit = 2 } = {}) {
    state.currentWordIndex = 0;
    state.sequenceFailed = false;
    state.failReason = "timeout";
    state.livesLeft = livesLimit;
    state.retriesLeft = retriesLimit;
    state.wordCaughtThisBeat = false;
    state.caughtWords.clear();
}
