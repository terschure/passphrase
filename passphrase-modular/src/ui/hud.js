export function renderLevelStatus({
    refs,
    entries,
    currentWordIndex,
    currentEntry,
}) {
    if (entries.length && currentWordIndex >= entries.length) {
        refs.currentLevelTitle.textContent = "complete";
        refs.currentSequenceTitle.textContent = "all sequences spoken";
        return;
    }

    if (!currentEntry) {
        refs.currentLevelTitle.textContent = "no level";
        refs.currentSequenceTitle.textContent = "no sequence";
        return;
    }

    refs.currentLevelTitle.textContent = currentEntry.levelTitle;
    refs.currentSequenceTitle.textContent = currentEntry.sequenceTitle;
}

export function renderScoreDisplay({
    scoreDisplay,
    entries,
    isSequenceMode,
    currentWordIndex,
    caughtWords,
    currentLevel,
    completedPhrasesFromLevel1,
}) {
    if (!scoreDisplay) {
        return;
    }

    const total = entries.length;
    const levelScore = isSequenceMode
        ? Math.min(currentWordIndex, total)
        : caughtWords.size;
    const score =
        currentLevel === 1
            ? levelScore
            : completedPhrasesFromLevel1.length + levelScore;
    scoreDisplay.textContent = `SCORE ${score}`;
}

export function renderLivesDisplay({
    livesDisplay,
    mode,
    livesLimit,
    livesLeft,
    retriesLeft,
    refillAnimationUntil,
    now,
    colorSpan,
}) {
    if (mode !== "lives") {
        livesDisplay.replaceChildren();
        livesDisplay.classList.remove("refill");
        return;
    }

    const currentLives = Math.min(
        livesLimit,
        Math.max(0, Number(livesLeft) || 0),
    );
    const lost = Math.max(0, livesLimit - currentLives);
    const isRefilling = now < refillAnimationUntil;
    const children = [
        colorSpan("hearts", "♥".repeat(currentLives) + "♡".repeat(lost)),
        document.createTextNode(" "),
        colorSpan("retries", `RETRIES ×${retriesLeft}`),
    ];

    if (isRefilling) {
        children.push(colorSpan("refill-note", "refilled"));
    }

    livesDisplay.classList.toggle("refill", isRefilling);
    livesDisplay.replaceChildren(...children);
}

export function renderSequenceStatusText({
    sequenceStatus,
    entries,
    words,
    isSequenceMode,
    sequenceFailed,
    failReason,
    currentWordIndex,
    currentEntry,
    deadline,
    mode,
    livesLeft,
    retriesLeft,
    wordCaughtThisBeat,
    now,
}) {
    if (!isSequenceMode) {
        sequenceStatus.textContent = entries.length
            ? `sequence: off\nlevel: ${entries[0].levelTitle}`
            : "sequence: off";
        return;
    }

    if (!words.length) {
        sequenceStatus.textContent = "sequence: no words";
        return;
    }

    if (sequenceFailed) {
        sequenceStatus.textContent = `sequence: ${failReason}\nlevel: ${currentEntry ? currentEntry.levelTitle : "done"}\npart: ${currentEntry ? currentEntry.sequenceTitle : "done"}\nexpected: ${words[currentWordIndex] || "done"}\npress reset seq`;
        return;
    }

    if (currentWordIndex >= words.length) {
        sequenceStatus.textContent = "sequence: complete\nall words spoken";
        return;
    }

    if (!deadline) {
        sequenceStatus.textContent = `sequence: armed\nlevel: ${currentEntry.levelTitle}\npart: ${currentEntry.sequenceTitle}\nspeak first: ${words[currentWordIndex]}`;
        return;
    }

    const remaining = Math.max(0, (deadline - now) / 1000);
    let extra = "";

    if (wordCaughtThisBeat) {
        extra = "\ncaught — gate open!";
    }

    if (mode === "lives") {
        extra += `\nlives: ${livesLeft} retries: ${retriesLeft}`;
    }

    sequenceStatus.textContent = `sequence: running\nlevel: ${currentEntry.levelTitle}\npart: ${currentEntry.sequenceTitle}\nnext: ${words[currentWordIndex]}\ntime: ${remaining.toFixed(1)}s${extra}`;
}
