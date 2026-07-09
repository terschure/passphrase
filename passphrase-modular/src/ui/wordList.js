export function renderWordList({
    wordList,
    entries,
    currentWordIndex,
    caughtWords,
    sequenceFailed,
    isSequenceMode,
}) {
    wordList.innerHTML = "";
    let lastLevelKey = null;
    let lastSequenceKey = null;

    for (const [index, entry] of entries.entries()) {
        const levelKey = `${entry.levelIndex}:${entry.levelTitle}`;
        const sequenceKey = `${levelKey}:${entry.sequenceIndex}:${entry.sequenceTitle}`;

        if (levelKey !== lastLevelKey) {
            const levelItem = document.createElement("li");
            levelItem.className = "word-heading";
            levelItem.textContent = `# ${entry.levelTitle}`;
            wordList.append(levelItem);
            lastLevelKey = levelKey;
            lastSequenceKey = null;
        }

        if (sequenceKey !== lastSequenceKey) {
            const sequenceItem = document.createElement("li");
            sequenceItem.className = "sequence-heading";
            sequenceItem.textContent = `## ${entry.sequenceTitle}`;
            wordList.append(sequenceItem);
            lastSequenceKey = sequenceKey;
        }

        const word = entry.text;
        const normalized = word.toLowerCase();
        const item = document.createElement("li");
        const isChecked = caughtWords.has(normalized);
        const isCurrent =
            isSequenceMode && index === currentWordIndex && !sequenceFailed;
        item.className = [
            isChecked ? "checked" : "",
            isCurrent ? "current" : "",
            sequenceFailed && isSequenceMode && index === currentWordIndex
                ? "failed"
                : "",
        ]
            .filter(Boolean)
            .join(" ");
        item.innerHTML = `<input type="checkbox" disabled ${isChecked ? "checked" : ""}> <span></span>`;
        item.querySelector("span").textContent =
            `${isCurrent ? "> " : "  "}${word}`;
        wordList.append(item);
    }
}
