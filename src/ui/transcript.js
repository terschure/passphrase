import {
    findFuzzyWordMatch,
    findJoinedTargetMatch,
} from "../matching/matching.js";

function rangesOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
}

export function collectTranscriptMatches(text, words, escapeRegExp) {
    const matches = [];

    for (const word of words.slice().sort((a, b) => b.length - a.length)) {
        const matcher = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");

        for (const match of text.matchAll(matcher)) {
            matches.push({
                kind: "exact",
                start: match.index,
                end: match.index + match[0].length,
            });
        }
    }

    for (const word of words) {
        const joinedMatch = findJoinedTargetMatch(text, word);

        if (joinedMatch) {
            matches.push({ kind: "partial", score: 1, ...joinedMatch });
        }

        const match = findFuzzyWordMatch(text, word);

        if (match) {
            matches.push({ kind: "partial", ...match });
        }
    }

    const nonOverlapping = matches
        .sort((a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === "exact" ? -1 : 1;
            }
            if (a.kind === "partial" && a.score !== b.score) {
                return b.score - a.score;
            }
            const lengthDifference =
                b.end - b.start - (a.end - a.start);
            return lengthDifference || a.start - b.start;
        })
        .filter((match, index, sorted) => {
            return !sorted.some(
                (other, otherIndex) =>
                    otherIndex < index && rangesOverlap(match, other),
            );
        });

    return nonOverlapping.sort((a, b) => a.start - b.start);
}

export function renderTranscript({
    finalText,
    interimText,
    gameOverTranscript,
    text,
    words,
    escapeRegExp,
    colorSpan,
}) {
    interimText.textContent = "";
    renderTranscriptInto({
        container: finalText,
        text,
        words,
        escapeRegExp,
        colorSpan,
    });
    renderTranscriptInto({
        container: gameOverTranscript,
        text,
        words,
        escapeRegExp,
        colorSpan,
    });
}

export function renderTranscriptInto({
    container,
    text,
    words,
    escapeRegExp,
    colorSpan,
}) {
    container.replaceChildren();

    if (!text || !words.length) {
        container.textContent = text;
        return;
    }

    const matches = collectTranscriptMatches(text, words, escapeRegExp);
    let last = 0;

    for (const match of matches) {
        if (match.start < last) {
            continue;
        }

        if (match.start > last) {
            container.append(text.slice(last, match.start));
        }

        container.append(
            colorSpan(
                match.kind === "exact" ? "hit" : "partial-hit",
                text.slice(match.start, match.end),
            ),
        );
        last = match.end;
    }

    container.append(text.slice(last));
}
