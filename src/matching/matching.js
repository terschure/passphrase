export function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isSentenceTarget(target) {
    return String(target).trim().split(/\s+/).length > 1;
}

export function tokenizeForFuzzy(text) {
    const tokens = [];
    const matcher = /[a-z0-9]+(?:'[a-z0-9]+)?/gi;
    let match;

    while ((match = matcher.exec(String(text || "")))) {
        tokens.push({
            value: match[0].toLowerCase(),
            start: match.index,
            end: match.index + match[0].length,
        });
    }

    return tokens;
}

function joinTokenValues(tokens) {
    return tokens.map((token) => token.value.replace(/'/g, "")).join("");
}

export function findJoinedTargetMatch(text, target, fromIndex = 0) {
    const targetTokens = tokenizeForFuzzy(target);

    if (!targetTokens.length) {
        return null;
    }

    const joinedTarget = joinTokenValues(targetTokens);
    const textTokens = tokenizeForFuzzy(text).filter(
        (token) => token.end > fromIndex,
    );

    for (let start = 0; start < textTokens.length; start += 1) {
        let joinedCandidate = "";

        for (let end = start; end < textTokens.length; end += 1) {
            joinedCandidate += textTokens[end].value.replace(/'/g, "");

            if (joinedCandidate === joinedTarget) {
                return {
                    start: textTokens[start].start,
                    end: textTokens[end].end,
                };
            }

            if (joinedCandidate.length >= joinedTarget.length) {
                break;
            }
        }
    }

    return null;
}

export function characterEditDistance(a, b) {
    const previous = Array.from(
        { length: b.length + 1 },
        (_, index) => index,
    );

    for (let i = 1; i <= a.length; i += 1) {
        const current = [i];

        for (let j = 1; j <= b.length; j += 1) {
            current[j] =
                a[i - 1] === b[j - 1]
                    ? previous[j - 1]
                    : Math.min(previous[j - 1], previous[j], current[j - 1]) +
                      1;
        }

        previous.splice(0, previous.length, ...current);
    }

    return previous[b.length];
}

export function wordSimilarity(a, b) {
    const maxLength = Math.max(a.length, b.length);

    if (!maxLength) {
        return 1;
    }

    return 1 - characterEditDistance(a, b) / maxLength;
}

export function findFuzzyWordMatch(text, target, fromIndex = 0) {
    const targetTokens = tokenizeForFuzzy(target);

    if (targetTokens.length !== 1) {
        return null;
    }

    const targetValue = targetTokens[0].value;

    if (targetValue.length < 4) {
        return null;
    }

    const threshold = targetValue.length <= 5 ? 0.8 : 0.7;
    const maximumLengthDifference = Math.max(
        2,
        Math.ceil(targetValue.length * 0.35),
    );
    let best = null;

    for (const token of tokenizeForFuzzy(text)) {
        if (token.end <= fromIndex || token.value === targetValue) {
            continue;
        }

        if (
            Math.abs(token.value.length - targetValue.length) >
            maximumLengthDifference
        ) {
            continue;
        }

        const score = wordSimilarity(token.value, targetValue);

        if (score >= threshold && (!best || score > best.score)) {
            best = {
                start: token.start,
                end: token.end,
                score,
            };
        }
    }

    return best;
}

export function tokenEditDistance(a, b) {
    const previous = Array.from(
        { length: b.length + 1 },
        (_, index) => index,
    );

    for (let i = 1; i <= a.length; i += 1) {
        const current = [i];

        for (let j = 1; j <= b.length; j += 1) {
            current[j] =
                a[i - 1] === b[j - 1]
                    ? previous[j - 1]
                    : Math.min(previous[j - 1], previous[j], current[j - 1]) +
                      1;
        }

        previous.splice(0, previous.length, ...current);
    }

    return previous[b.length];
}

export function findFuzzySentenceEnd(
    text,
    target,
    fromIndex = 0,
    threshold = 0.78,
) {
    if (threshold >= 1) {
        return -1;
    }

    const targetTokens = tokenizeForFuzzy(target).map((token) => token.value);

    if (targetTokens.length < 2) {
        return -1;
    }

    const textTokens = tokenizeForFuzzy(text).filter(
        (token) => token.end > fromIndex,
    );
    const targetLength = targetTokens.length;
    const windowSlack = Math.max(
        1,
        Math.ceil(targetLength * (1 - threshold)) + 1,
    );

    for (let start = 0; start < textTokens.length; start += 1) {
        let bestAtStart = null;

        for (
            let length = Math.max(1, targetLength - windowSlack);
            length <= targetLength + windowSlack;
            length += 1
        ) {
            const window = textTokens.slice(start, start + length);

            if (window.length !== length) {
                continue;
            }

            const distance = tokenEditDistance(
                targetTokens,
                window.map((token) => token.value),
            );
            const score =
                1 - distance / Math.max(targetTokens.length, window.length);

            if (
                score >= threshold &&
                (!bestAtStart || score > bestAtStart.score)
            ) {
                bestAtStart = {
                    score,
                    end: window[window.length - 1].end,
                };
            }
        }

        if (bestAtStart) {
            return bestAtStart.end;
        }
    }

    return -1;
}

export function normalizeSpokenTarget(target) {
    return String(target || "")
        .replace(/\*/g, " star ")
        .replace(/\.(?=[a-z0-9])/gi, " ")
        .replace(/[.,!?]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function findTargetEnd(
    text,
    target,
    { fromIndex = 0, fuzzyThreshold = 0.78 } = {},
) {
    const source = String(text || "");
    const rawTarget = String(target || "");
    const spokenTarget = normalizeSpokenTarget(rawTarget);

    if (
        spokenTarget &&
        spokenTarget.toLowerCase() !== rawTarget.toLowerCase()
    ) {
        const spokenMatcher = new RegExp(
            "\\b" + escapeRegExp(spokenTarget) + "\\b",
            "gi",
        );
        spokenMatcher.lastIndex = fromIndex;
        const spokenMatch = spokenMatcher.exec(source);

        if (spokenMatch) {
            return spokenMatch.index + spokenMatch[0].length;
        }
    }

    const matcher = new RegExp(`\\b${escapeRegExp(rawTarget)}\\b`, "gi");
    matcher.lastIndex = fromIndex;
    const match = matcher.exec(source);

    if (match) {
        return match.index + match[0].length;
    }

    const joinedMatch = findJoinedTargetMatch(source, rawTarget, fromIndex);

    if (joinedMatch) {
        return joinedMatch.end;
    }

    if (isSentenceTarget(rawTarget)) {
        return findFuzzySentenceEnd(
            source,
            rawTarget,
            fromIndex,
            fuzzyThreshold,
        );
    }

    return findFuzzyWordMatch(source, rawTarget, fromIndex)?.end ?? -1;
}

export function textMatchesTarget(text, target, options = {}) {
    return findTargetEnd(text, target, options) !== -1;
}

export function findOrderedMatchEnd(text, words, completedCount, options = {}) {
    let searchFrom = 0;

    for (let i = 0; i < completedCount; i += 1) {
        const end = findTargetEnd(text, words[i], {
            ...options,
            fromIndex: searchFrom,
        });
        if (end !== -1) {
            searchFrom = end;
        }
    }

    return findTargetEnd(text, words[completedCount], {
        ...options,
        fromIndex: searchFrom,
    });
}
