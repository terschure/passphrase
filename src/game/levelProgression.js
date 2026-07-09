export function getNextLevel(levels, currentLevel) {
    return levels.find((level) => level.id === currentLevel + 1) || null;
}

export function getKeygenDistortionForLevel(level, maxLevel = 5) {
    return Math.min(Math.max(((Number(level) || 1) - 1) / (maxLevel - 1), 0), 1);
}

export function createLevelActivationState({
    level,
    entryCount,
    showIntro,
    livesLimit,
    retriesLimit,
}) {
    return {
        currentLevel: level.id,
        currentWordIndex: 0,
        totalWordsPerLevel: entryCount,
        levelTransitionActive: showIntro,
        sequenceFailed: false,
        failReason: "timeout",
        deadline: null,
        wordCaughtThisBeat: false,
        gateOpenedAt: 0,
        wallEchoFiredThisBeat: false,
        livesLeft: livesLimit,
        retriesLeft: retriesLimit,
        refillAnimationUntil: 0,
        lastKeygenHitAt: 0,
    };
}
