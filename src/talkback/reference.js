export function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
        ...options,
        signal: controller.signal,
    }).finally(() => {
        clearTimeout(timer);
    });
}

export function talkbackUrl(endpoint, path) {
    const normalized = String(endpoint || "").trim().replace(/\/+$/, "");
    return normalized ? `${normalized}${path}` : "";
}

export function selectTalkbackReference({
    segments,
    minRefSeconds = 5,
    targetRefSeconds = 12,
    encodeWavFromBuffers,
}) {
    if (!segments.length) {
        return null;
    }

    const longEnough = segments
        .filter((segment) => segment.duration >= minRefSeconds)
        .sort((a, b) => b.duration - a.duration);

    if (longEnough.length) {
        return {
            blob: longEnough[0].blob,
            transcript: longEnough[0].transcript,
            duration: longEnough[0].duration,
            signature: `${longEnough[0].createdAt}`,
        };
    }

    const selected = [];
    let duration = 0;

    for (const segment of segments.slice().reverse()) {
        selected.unshift(segment);
        duration += segment.duration;

        if (duration >= minRefSeconds) {
            break;
        }
    }

    if (duration < minRefSeconds) {
        return null;
    }

    while (selected.length > 1 && duration > targetRefSeconds) {
        duration -= selected[0].duration;
        selected.shift();
    }

    return {
        blob: encodeWavFromBuffers(selected.map((segment) => segment.buffer)),
        transcript: selected.map((segment) => segment.transcript).join(" "),
        duration,
        signature: selected.map((segment) => segment.createdAt).join(":"),
    };
}
