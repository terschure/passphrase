import { hashCell } from "../renderers/ascii/hash.js";

export function generateAsciiWaveform(
    width,
    height,
    amplitude,
    timestamp,
    mode = "ambient",
) {
    const rows = Array.from({ length: height }, () => Array(width).fill(" "));
    const center = Math.floor(height / 2);
    const t = timestamp / 340;
    const loudness = Math.min(1, Math.max(0, amplitude));
    const maxPeak = Math.max(
        1,
        Math.floor((height / 2 - 1) * (0.32 + loudness * 0.86)),
    );

    for (let x = 0; x < width; x += 1) {
        const n =
            Math.sin(x * 0.19 + t) * 0.45 +
            Math.sin(x * 0.47 - t * 1.3) * 0.33 +
            Math.sin(x * 0.91 + t * 0.7) * 0.22;
        const cluster = Math.sin(x * 0.08 + t * 0.4) > 0.28 ? 1 : 0.36;
        const peak = Math.floor(Math.abs(n) * maxPeak * cluster);
        const baselineChar = mode === "broken" && x % 11 === 0 ? "." : "_";
        rows[center][x] = peak > 0 ? "-" : baselineChar;

        for (let y = 1; y <= peak; y += 1) {
            const upper = center - y;
            const lower = center + y;
            const spikeChar =
                y === peak ? (x % 5 === 0 ? "^" : "/") : x % 3 === 0 ? "|" : ":";

            if (upper >= 0) {
                rows[upper][x] = spikeChar;
            }

            if (lower < height && x % 2 === 0) {
                rows[lower][x] = y === peak ? "v" : "|";
            }
        }

        if (mode === "broken" && (x + Math.floor(t)) % 13 === 0) {
            const glitchRow = Math.abs(hashCell(x, Math.floor(t))) % height;
            rows[glitchRow][x] = ["'", ".", "x", "0", "#"][x % 5];
        }
    }

    return rows.map((row) => row.join("")).join("\n");
}

export function updateAsciiWaveformBackground({
    element,
    currentLevel,
    amplitude = 0,
    timestamp = performance.now(),
    viewportWidth = window.innerWidth,
}) {
    const isLevelOne = currentLevel === 1;
    element.style.opacity = String(
        isLevelOne
            ? 0.54 + Math.min(1, amplitude) * 0.3
            : 0.16 + Math.min(1, amplitude) * 0.18,
    );
    element.textContent = generateAsciiWaveform(
        Math.max(72, Math.ceil(viewportWidth / 9)),
        isLevelOne ? 19 : 11,
        amplitude,
        timestamp,
        "ambient",
    );
}

export function updateGameOverFire({
    element,
    wallFireFrameCount,
    lastFrameIndex,
    force = false,
    now = Date.now(),
    viewportWidth = window.innerWidth,
}) {
    if (!element) {
        return lastFrameIndex;
    }

    const frameIndex = Math.floor(now / 160) % wallFireFrameCount;

    if (!force && frameIndex === lastFrameIndex) {
        return lastFrameIndex;
    }

    const width = Math.max(28, Math.min(48, Math.floor((viewportWidth - 40) / 7)));
    const frames = createGameOverFireFrames(width);
    element.textContent = frames[frameIndex % frames.length].join("\n");
    return frameIndex;
}

export function createGameOverFireFrames(width) {
    const frames = [
        [
            "    ^     `     ^      '    ^   ",
            "   /|\\    ^    /|\\    /\\   /|\\  ",
            "  //|\\\\  /|\\  //|\\\\  /  \\ //|\\\\ ",
            " / /| \\\\//|\\\\ / | \\\\// /\\ \\/ | \\",
            "/__/ \\__\\/ \\\\/__/ \\__\\/  \\__/ \\",
        ],
        [
            "  `    ^     .     ^     `    ^ ",
            "      /|\\         /|\\   /\\   /|\\",
            " /\\  //|\\\\   ^   //|\\\\ /  \\ //|",
            "/  \\/ /| \\\\ /|\\ / /| \\\\/ /\\ \\/ ",
            "\\__/__/ \\__\\/ \\\\__/ \\__\\/  \\__",
        ],
        [
            " ^     '    ^     `     ^     . ",
            "/|\\        /|\\         /|\\   /\\ ",
            "||\\\\  /\\  //|\\\\  /\\  //|\\\\ /  \\",
            "| \\\\ /  \\/ /| \\\\/  \\/ /| \\\\/ /\\",
            "|__\\/ /\\ \\/ \\__\\/\\__\\/ \\__\\/  ",
        ],
    ];

    return frames.map((frame) =>
        frame.map((line, rowIndex) => {
            let expanded = line;

            while (expanded.length < width + line.length) {
                expanded += line;
            }

            const sway = (rowIndex * 7) % line.length;
            return expanded.slice(sway, sway + width);
        }),
    );
}

export function updateGameOverWaveform({
    visualizerElement,
    fireElement,
    createScaryFireFrames,
    wallFireFrameCount,
    lastFireFrameIndex,
    amplitude = 0.4,
    timestamp = performance.now(),
    viewportWidth = window.innerWidth,
}) {
    const nextFireFrameIndex = updateGameOverFire({
        element: fireElement,
        wallFireFrameCount,
        lastFrameIndex: lastFireFrameIndex,
        now: Date.now(),
        viewportWidth,
    });

    visualizerElement.textContent = generateAsciiWaveform(
        54,
        7,
        amplitude,
        timestamp,
        "broken",
    );

    return nextFireFrameIndex;
}
