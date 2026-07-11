export function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isSentenceTarget(target) {
    return String(target).trim().split(/\s+/).length > 1;
}

const ENGLISH_SPELLING_VARIANT_PAIRS = [
    ["favorite", "favourite"],
    ["favorites", "favourites"],
    ["favor", "favour"],
    ["favored", "favoured"],
    ["favoring", "favouring"],
    ["favorable", "favourable"],
    ["color", "colour"],
    ["colors", "colours"],
    ["colored", "coloured"],
    ["coloring", "colouring"],
    ["honor", "honour"],
    ["honored", "honoured"],
    ["honoring", "honouring"],
    ["behavior", "behaviour"],
    ["neighbor", "neighbour"],
    ["labor", "labour"],
    ["center", "centre"],
    ["centers", "centres"],
    ["centered", "centred"],
    ["centering", "centring"],
    ["theater", "theatre"],
    ["meter", "metre"],
    ["liter", "litre"],
    ["fiber", "fibre"],
    ["organize", "organise"],
    ["organized", "organised"],
    ["organizing", "organising"],
    ["recognize", "recognise"],
    ["recognized", "recognised"],
    ["recognizing", "recognising"],
    ["realize", "realise"],
    ["realized", "realised"],
    ["realizing", "realising"],
    ["analyze", "analyse"],
    ["analyzed", "analysed"],
    ["analyzing", "analysing"],
    ["defense", "defence"],
    ["offense", "offence"],
    ["license", "licence"],
    ["traveled", "travelled"],
    ["traveling", "travelling"],
    ["traveler", "traveller"],
    ["canceled", "cancelled"],
    ["canceling", "cancelling"],
    ["labeled", "labelled"],
    ["labeling", "labelling"],
    ["catalog", "catalogue"],
    ["catalogs", "catalogues"],
    ["cataloged", "catalogued"],
    ["gray", "grey"],
    ["jewelry", "jewellery"],
    ["mold", "mould"],
    ["plow", "plough"],
    ["program", "programme"],
    ["tire", "tyre"],
    ["aluminum", "aluminium"],
    ["pediatric", "paediatric"],
    ["archeology", "archaeology"],
];

const ENGLISH_SPELLING_CANONICAL = new Map(
    ENGLISH_SPELLING_VARIANT_PAIRS.flatMap(([american, british]) => [
        [american, american],
        [british, american],
    ]),
);

export function normalizeEnglishSpelling(word) {
    const value = String(word || "").toLowerCase();
    return ENGLISH_SPELLING_CANONICAL.get(value) || value;
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

export function findEnglishSpellingVariantMatch(text, target, fromIndex = 0) {
    const targetTokens = tokenizeForFuzzy(target);

    if (!targetTokens.length) {
        return null;
    }

    const sourceTokens = tokenizeForFuzzy(text).filter(
        (token) => token.end > fromIndex,
    );

    for (
        let start = 0;
        start + targetTokens.length <= sourceTokens.length;
        start += 1
    ) {
        const window = sourceTokens.slice(start, start + targetTokens.length);
        const equivalent = targetTokens.every(
            (token, index) =>
                normalizeEnglishSpelling(token.value) ===
                normalizeEnglishSpelling(window[index].value),
        );

        if (equivalent) {
            return {
                start: window[0].start,
                end: window[window.length - 1].end,
            };
        }
    }

    return null;
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

function getFuzzyWordThreshold(value) {
    return value.length <= 5 ? 0.8 : 0.7;
}

function getFuzzyWordValueScore(targetValue, candidateValue) {
    if (targetValue === candidateValue) {
        return 1;
    }

    if (targetValue.length < 4) {
        return null;
    }

    const maximumLengthDifference = Math.max(
        2,
        Math.ceil(targetValue.length * 0.35),
    );

    if (
        Math.abs(candidateValue.length - targetValue.length) >
        maximumLengthDifference
    ) {
        return null;
    }

    const score = wordSimilarity(candidateValue, targetValue);
    return score >= 0.5 ? score : null;
}

export function findSegmentedFuzzyTargetMatch(
    text,
    target,
    fromIndex = 0,
    threshold = 0.78,
) {
    const targetTokens = tokenizeForFuzzy(target);

    if (targetTokens.length < 2) {
        return null;
    }

    const textTokens = tokenizeForFuzzy(text).filter(
        (token) => token.end > fromIndex,
    );

    function matchFrom(targetIndex, textIndex, scoreTotal, weakMatchCount) {
        if (targetIndex >= targetTokens.length) {
            return scoreTotal / targetTokens.length >= threshold
                ? textIndex
                : null;
        }

        const targetValue = targetTokens[targetIndex].value.replace(/'/g, "");

        for (let tokenCount = 1; tokenCount <= 2; tokenCount += 1) {
            const candidateTokens = textTokens.slice(
                textIndex,
                textIndex + tokenCount,
            );

            if (candidateTokens.length !== tokenCount) {
                continue;
            }

            const candidateValue = joinTokenValues(candidateTokens);
            const score = getFuzzyWordValueScore(
                targetValue,
                candidateValue,
            );

            if (score === null) {
                continue;
            }

            const isWeak = score < getFuzzyWordThreshold(targetValue);

            // A longer phrase supplies enough context for one uncertain ASR
            // substitution. Multiple weak words, or one in a two-word phrase,
            // remain too ambiguous.
            if (
                isWeak &&
                (targetTokens.length < 3 || weakMatchCount >= 1)
            ) {
                continue;
            }

            const endIndex = matchFrom(
                targetIndex + 1,
                textIndex + tokenCount,
                scoreTotal + score,
                weakMatchCount + (isWeak ? 1 : 0),
            );

            if (endIndex !== null) {
                return endIndex;
            }
        }

        return null;
    }

    for (let start = 0; start < textTokens.length; start += 1) {
        const endIndex = matchFrom(0, start, 0, 0);

        if (endIndex !== null) {
            return {
                start: textTokens[start].start,
                end: textTokens[endIndex - 1].end,
            };
        }
    }

    return null;
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

    const threshold = getFuzzyWordThreshold(targetValue);
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

    const spellingVariantMatch = findEnglishSpellingVariantMatch(
        source,
        rawTarget,
        fromIndex,
    );

    if (spellingVariantMatch) {
        return spellingVariantMatch.end;
    }

    const joinedMatch = findJoinedTargetMatch(source, rawTarget, fromIndex);

    if (joinedMatch) {
        return joinedMatch.end;
    }

    const segmentedFuzzyMatch =
        fuzzyThreshold < 1
            ? findSegmentedFuzzyTargetMatch(
                  source,
                  rawTarget,
                  fromIndex,
                  fuzzyThreshold,
              )
            : null;

    if (segmentedFuzzyMatch) {
        return segmentedFuzzyMatch.end;
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
