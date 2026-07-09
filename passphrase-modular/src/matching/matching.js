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

    return isSentenceTarget(rawTarget)
        ? findFuzzySentenceEnd(source, rawTarget, fromIndex, fuzzyThreshold)
        : -1;
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
