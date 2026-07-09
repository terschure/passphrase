export function echoAllows(mode, kind) {
    if (mode === "both") {
        return true;
    }

    if (mode === "random") {
        return kind === "random";
    }

    if (mode === "key") {
        return kind !== "random";
    }

    return false;
}

export function pickEchoRate(random = Math.random) {
    return random() < 0.5
        ? 0.7 + random() * 0.15
        : 1.15 + random() * 0.25;
}

export function selectEchoSnippet({
    snippets,
    currentWord,
    textHasWord,
    random = Math.random,
}) {
    const idle = snippets.filter((snippet) => snippet.state === "idle");
    const safe = currentWord
        ? idle.filter((snippet) => !textHasWord(snippet.label, currentWord))
        : idle;
    const pool = safe.length ? safe : idle;

    return pool[Math.floor(random() * pool.length)] || null;
}

export function shouldTriggerEcho({
    mode,
    kind,
    progress,
    snippetCount,
    hasMicStream,
    now,
    lastEchoAt,
    cooldownMs = 4000,
    cooldownFloor = 0.4,
    probabilities = { beat: 0.35, wall: 0.5, life: 1, random: 0.25 },
    progressBoost = 1.5,
    random = Math.random,
}) {
    const cooldown = cooldownMs * (1 - (1 - cooldownFloor) * progress);

    if (
        !hasMicStream ||
        mode === "off" ||
        !echoAllows(mode, kind) ||
        !snippetCount ||
        now - lastEchoAt < cooldown
    ) {
        return false;
    }

    const chance = Math.min(
        1,
        (probabilities[kind] || 0) * (1 + progressBoost * progress),
    );

    return random() < chance;
}
