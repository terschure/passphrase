import { isBeatMode, markCurrentWordCaught } from "./rules.js";

export function findSequenceSearchStart(
    text,
    words,
    currentWordIndex,
    findWordEnd,
) {
    let searchFrom = 0;
    const currentPhrase = String(words[currentWordIndex] || "")
        .trim()
        .toLowerCase();

    for (let i = 0; i < currentWordIndex; i += 1) {
        // Recognition often returns only the latest spoken phrase. Do not let
        // an earlier duplicate target claim the sole occurrence that belongs
        // to the currently active target.
        if (String(words[i] || "").trim().toLowerCase() === currentPhrase) {
            continue;
        }

        const end = findWordEnd(text, words[i], searchFrom);
        if (end !== -1) {
            searchFrom = end;
        }
    }

    return searchFrom;
}

export function consumeSequenceText(
    state,
    words,
    text,
    { mode, findWordEnd },
) {
    const result = {
        changed: false,
        completed: false,
        beatHit: false,
        caughtPhrases: [],
        completedPhrases: [],
    };

    if (state.sequenceFailed || state.currentWordIndex >= words.length) {
        return result;
    }

    let searchFrom = findSequenceSearchStart(
        text,
        words,
        state.currentWordIndex,
        findWordEnd,
    );

    if (isBeatMode(mode)) {
        const phrase = words[state.currentWordIndex];
        if (
            !state.wordCaughtThisBeat &&
            phrase &&
            findWordEnd(text, phrase, searchFrom) !== -1
        ) {
            const markResult = markCurrentWordCaught(state, words, mode);
            result.changed = markResult.changed;
            result.beatHit = markResult.changed;
            if (markResult.changed) {
                result.caughtPhrases.push(phrase);
            }
        }

        return result;
    }

    while (state.currentWordIndex < words.length) {
        const phrase = words[state.currentWordIndex];
        const end = findWordEnd(text, phrase, searchFrom);

        if (end === -1) {
            break;
        }

        searchFrom = end;
        const markResult = markCurrentWordCaught(state, words, mode);
        if (!markResult.changed) {
            break;
        }

        result.changed = true;
        result.caughtPhrases.push(phrase);
        result.completedPhrases.push(phrase);
        result.completed = markResult.completed;
    }

    return result;
}
