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

function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
}

function percentile(sortedValues, fraction) {
    if (!sortedValues.length) {
        return 0;
    }

    const index = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.floor((sortedValues.length - 1) * fraction)),
    );
    return sortedValues[index];
}

export function countTranscriptWords(transcript) {
    const normalized = String(transcript || "").trim();
    return normalized ? normalized.split(/\s+/).length : 0;
}

export function analyzeTalkbackSegmentQuality({
    buffer,
    transcript,
    trimRms = 0.02,
    frameMs = 20,
    weights = {
        clarity: 0.4,
        activity: 0.25,
        loudness: 0.2,
        clipping: 0.15,
    },
}) {
    const data = buffer.getChannelData(0);
    const frameLength = Math.max(
        1,
        Math.round((buffer.sampleRate * frameMs) / 1000),
    );
    const frameRmsValues = [];
    let total = 0;
    let sampleCount = 0;
    let peak = 0;
    let clippedCount = 0;

    for (let start = 0; start < data.length; start += frameLength) {
        const end = Math.min(data.length, start + frameLength);
        let frameTotal = 0;
        let frameCount = 0;

        for (let index = start; index < end; index += 4) {
            const absolute = Math.abs(data[index]);
            const squared = data[index] * data[index];
            peak = Math.max(peak, absolute);
            clippedCount += absolute >= 0.98 ? 1 : 0;
            frameTotal += squared;
            frameCount += 1;
            total += squared;
            sampleCount += 1;
        }

        frameRmsValues.push(
            Math.sqrt(frameTotal / Math.max(1, frameCount)),
        );
    }

    const sortedFrames = frameRmsValues.slice().sort((a, b) => a - b);
    const noiseFloorRms = percentile(sortedFrames, 0.2);
    const voiceRms = percentile(sortedFrames, 0.8);
    const activeThreshold = Math.max(
        trimRms,
        Math.min(noiseFloorRms * 1.8, voiceRms * 0.55),
    );
    const voiceActiveRatio =
        frameRmsValues.filter((value) => value >= activeThreshold).length /
        Math.max(1, frameRmsValues.length);
    const rms = Math.sqrt(total / Math.max(1, sampleCount));
    const clippedRatio = clippedCount / Math.max(1, sampleCount);
    const clarityDb = clamp(
        20 * Math.log10((voiceRms + 1e-6) / (noiseFloorRms + 1e-6)),
        0,
        30,
    );
    let loudnessScore = clamp(rms / 0.05);

    if (rms > 0.25) {
        loudnessScore *= clamp((0.5 - rms) / 0.25);
    }

    const components = {
        clarity: clamp(clarityDb / 18),
        activity: clamp((voiceActiveRatio - 0.15) / 0.55),
        loudness: loudnessScore,
        clipping: 1 - clamp(clippedRatio / 0.02),
    };
    const weightTotal = Object.values(weights).reduce(
        (sum, value) => sum + value,
        0,
    );
    const score =
        Object.entries(weights).reduce(
            (sum, [name, weight]) =>
                sum + (components[name] || 0) * weight,
            0,
        ) / Math.max(1e-6, weightTotal);

    return {
        score: clamp(score),
        rms,
        peak,
        clippedRatio,
        voiceActiveRatio,
        noiseFloorRms,
        voiceRms,
        clarityDb,
        wordCount: countTranscriptWords(transcript),
    };
}

function getSegmentQuality(segment) {
    return {
        score: segment.quality?.score ?? 1,
        clippedRatio: segment.quality?.clippedRatio ?? 0,
        voiceActiveRatio: segment.quality?.voiceActiveRatio ?? 1,
        wordCount:
            segment.quality?.wordCount ??
            segment.wordCount ??
            countTranscriptWords(segment.transcript),
    };
}

function compareCandidates(a, b, highQualityScore) {
    const aQuality = getSegmentQuality(a);
    const bQuality = getSegmentQuality(b);
    const aHigh = aQuality.score >= highQualityScore;
    const bHigh = bQuality.score >= highQualityScore;

    if (aHigh !== bHigh) {
        return aHigh ? -1 : 1;
    }

    if (aHigh && (aQuality.wordCount > 1) !== (bQuality.wordCount > 1)) {
        return aQuality.wordCount > 1 ? -1 : 1;
    }

    if (bQuality.score !== aQuality.score) {
        return bQuality.score - aQuality.score;
    }

    if (bQuality.wordCount !== aQuality.wordCount) {
        return bQuality.wordCount - aQuality.wordCount;
    }

    if (b.duration !== a.duration) {
        return b.duration - a.duration;
    }

    return b.createdAt - a.createdAt;
}

function segmentSignature(segment) {
    return String(segment.signatureKey ?? segment.createdAt);
}

export function selectTalkbackReference({
    segments,
    minRefSeconds = 5,
    targetRefSeconds = 12,
    minVoiceActiveRatio = 0.25,
    maxClippedRatio = 0.05,
    usableQualityScore = 0.45,
    highQualityScore = 0.7,
    encodeWavFromBuffers,
}) {
    if (!segments.length) {
        return null;
    }

    const candidates = segments
        .filter((segment) => {
            const quality = getSegmentQuality(segment);
            return (
                quality.score >= usableQualityScore &&
                quality.clippedRatio <= maxClippedRatio &&
                quality.voiceActiveRatio >= minVoiceActiveRatio
            );
        })
        .sort((a, b) => compareCandidates(a, b, highQualityScore));
    const longEnough = candidates.filter(
        (segment) => segment.duration >= minRefSeconds,
    );

    if (longEnough.length) {
        return {
            blob: longEnough[0].blob,
            transcript: longEnough[0].transcript,
            duration: longEnough[0].duration,
            signature: segmentSignature(longEnough[0]),
        };
    }

    const selected = [];
    let duration = 0;
    const remaining = candidates.slice();

    while (remaining.length && duration < minRefSeconds) {
        const completingIndex = remaining.findIndex(
            (segment) =>
                duration + segment.duration >= minRefSeconds &&
                duration + segment.duration <= targetRefSeconds,
        );
        const index = completingIndex >= 0 ? completingIndex : 0;
        const [segment] = remaining.splice(index, 1);
        selected.push(segment);
        duration += segment.duration;
    }

    if (duration < minRefSeconds) {
        return null;
    }

    selected.sort((a, b) => a.createdAt - b.createdAt);

    return {
        blob: encodeWavFromBuffers(selected.map((segment) => segment.buffer)),
        transcript: selected.map((segment) => segment.transcript).join(" "),
        duration,
        signature: selected.map(segmentSignature).join(":"),
    };
}
