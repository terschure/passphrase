export function createTimelineRenderState({
    levelTransitionActive,
    sequenceMode,
    mode,
    deadline,
    wordStartedAt = 0,
    secondsLimit,
    now,
    metrics,
    words,
    currentWordIndex,
    sequenceFailed,
    wordCaughtThisBeat,
    gateOpenedAt,
    gateAnimationMs,
    beatMode,
}) {
    if (levelTransitionActive) {
        return {
            timelineText: null,
            timerText: "--.-",
            road: { word: null, wallRow: -10, gateProgress: null },
            checkCollision: false,
        };
    }

    if (!sequenceMode) {
        return {
            timelineText: "mode: catch",
            timerText: "--.-",
            road: { word: null, wallRow: -10, gateProgress: null },
            checkCollision: false,
        };
    }

    const remaining = deadline
        ? Math.max(0, (deadline - now) / 1000)
        : secondsLimit;
    const elapsed = deadline
        ? Math.min(
              secondsLimit,
              wordStartedAt
                  ? Math.max(0, (now - wordStartedAt) / 1000)
                  : secondsLimit - remaining,
          )
        : 0;
    const wallRow = Math.round(
        -3 + (elapsed / secondsLimit) * (metrics.carRow - 1),
    );
    const activeWord = words[currentWordIndex] || "--";
    const complete = currentWordIndex >= words.length && words.length > 0;
    const timelineText = `mode: ${mode} ${currentWordIndex}/${words.length}`;

    if (!words.length) {
        return {
            timelineText,
            timerText: "--.-",
            road: { word: null, wallRow: -10, gateProgress: null },
            checkCollision: false,
        };
    }

    if (sequenceFailed) {
        return {
            timelineText,
            timerText: "00.0",
            road: {
                word: activeWord,
                wallRow: metrics.carRow - 2,
                gateProgress: null,
            },
            checkCollision: false,
        };
    }

    if (complete) {
        return {
            timelineText,
            timerText: "DONE",
            road: { word: null, wallRow: -10, gateProgress: null },
            checkCollision: false,
        };
    }

    return {
        timelineText,
        timerText: deadline
            ? `${wordCaughtThisBeat ? "✓ " : ""}${remaining.toFixed(1)}`
            : `${secondsLimit}.0`,
        road: {
            word: activeWord,
            wallRow,
            gateProgress:
                beatMode && wordCaughtThisBeat
                    ? Math.min(1, (now - gateOpenedAt) / gateAnimationMs)
                    : null,
        },
        checkCollision: true,
    };
}
