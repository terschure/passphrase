export const DEFAULT_ECHO_WAVE_BUCKETS = 40;

export function computeRms(buffer, stride = 32) {
    const data = buffer.getChannelData(0);
    let total = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += stride) {
        total += data[i] * data[i];
        count += 1;
    }

    return Math.sqrt(total / Math.max(1, count));
}

export function computePeaks(buffer, bucketCount = DEFAULT_ECHO_WAVE_BUCKETS) {
    const data = buffer.getChannelData(0);
    const peaks = [];
    const step = Math.floor(data.length / bucketCount) || 1;

    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
        let max = 0;

        for (
            let i = bucket * step;
            i < (bucket + 1) * step && i < data.length;
            i += 16
        ) {
            max = Math.max(max, Math.abs(data[i]));
        }

        peaks.push(max);
    }

    return peaks;
}

export function trimSilence(buffer, createBuffer, {
    trimRms = 0.02,
    trimPadMs = 60,
    windowSize = 1024,
} = {}) {
    const data = buffer.getChannelData(0);
    let firstLoud = -1;
    let lastLoud = -1;

    for (let start = 0; start < data.length; start += windowSize) {
        const end = Math.min(data.length, start + windowSize);
        let total = 0;
        let count = 0;

        for (let i = start; i < end; i += 4) {
            total += data[i] * data[i];
            count += 1;
        }

        const rms = Math.sqrt(total / Math.max(1, count));

        if (rms >= trimRms) {
            if (firstLoud === -1) {
                firstLoud = start;
            }

            lastLoud = end;
        }
    }

    if (firstLoud === -1) {
        return null;
    }

    const pad = Math.round((trimPadMs / 1000) * buffer.sampleRate);
    const from = Math.max(0, firstLoud - pad);
    const to = Math.min(data.length, lastLoud + pad);

    if (from === 0 && to === data.length) {
        return buffer;
    }

    const trimmed = createBuffer(
        buffer.numberOfChannels,
        to - from,
        buffer.sampleRate,
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        trimmed.copyToChannel(
            buffer.getChannelData(channel).subarray(from, to),
            channel,
        );
    }

    return trimmed;
}

export function writeAscii(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
    }
}

export function encodeWavFromFloat32(samples, sampleRate) {
    const wav = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wav);
    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    for (let i = 0; i < samples.length; i += 1) {
        const value = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(
            44 + i * 2,
            value < 0 ? value * 0x8000 : value * 0x7fff,
            true,
        );
    }

    return wav;
}
