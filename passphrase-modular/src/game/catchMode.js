export function consumeCatchText(caughtWords, words, text, textMatchesTarget) {
    let changed = false;
    const caught = [];

    for (const word of words) {
        if (!textMatchesTarget(text, word)) {
            continue;
        }

        const normalized = word.toLowerCase();

        if (!caughtWords.has(normalized)) {
            changed = true;
            caught.push(word);
        }

        caughtWords.add(normalized);
    }

    return { changed, caught };
}
