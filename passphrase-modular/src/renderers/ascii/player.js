import { hashCell } from "./hash.js";
import { getLevel2CableRoadTop } from "./roadScene.js";

const KEYGEN_WIDTH = 17;
const KEYGEN_HEIGHT = 6;
const PASSPORT_WIDTH = 15;
const PASSPORT_HEIGHT = 14;
const PASSWORD_KEY_WIDTH = 19;
const PASSWORD_KEY_HEIGHT = 13;
const KEYGEN_PARTICLES = ["'", ".", "0", "x", "%", ":", "?"];

export const KEYGEN_SIGNAL_ROWS = 3;
export const KEYGEN_HIT_COOLDOWN_MS = 1000;

export function getPlayerBounds(metrics, currentLevel) {
    const center = Math.floor((metrics.laneLeft + metrics.laneRight) / 2);
    const isPasswordKey = currentLevel === 2;
    const width = isPasswordKey ? PASSWORD_KEY_WIDTH : PASSPORT_WIDTH;
    const height = isPasswordKey ? PASSWORD_KEY_HEIGHT : PASSPORT_HEIGHT;
    const bottom = isPasswordKey
        ? Math.min(metrics.height - 3, metrics.carRow + 5)
        : metrics.carRow - 3 + height - 1;

    return {
        left: center - Math.floor(width / 2),
        right: center - Math.floor(width / 2) + width - 1,
        top: bottom - height + 1,
        bottom,
        width,
        height,
    };
}

function padPlayerLine(line, width) {
    const clipped = line.slice(0, width);
    const leftPad = Math.floor((width - clipped.length) / 2);

    return (" ".repeat(Math.max(0, leftPad)) + clipped).padEnd(width, " ");
}

export function createKeygenLines({
    state,
    distortion,
    now = Date.now(),
}) {
    const tick = Math.floor(now / 140);
    const jitter = distortion > 0.55 && tick % 2 ? 1 : 0;
    const isBroken = state === "broken";
    const lines = (
        isBroken
            ? [
                  " x +--/--+    ",
                  "   |INVALID|  ",
                  " ' |A?-## | x ",
                  "   |NO KEY |  ",
                  " % +_/==\\+    ",
                  "    /    \\    ",
              ]
            : [
                  " . +--------+  ",
                  "   |KEYGEN  |  ",
                  " ' |A7-X9   |x ",
                  "   |ACCESS? |  ",
                  " % +--==--+   ",
                  "     ||  ||    ",
              ]
    ).map((line) => padPlayerLine(line, KEYGEN_WIDTH));

    return lines.map((line, rowIndex) => {
        const chars = line.split("");
        const particleLimit = Math.round(distortion * 5);

        for (let i = 0; i < particleLimit; i += 1) {
            const h = hashCell(tick + rowIndex * 37, i * 19);
            const col = h % chars.length;

            if (chars[col] === " ") {
                chars[col] = KEYGEN_PARTICLES[(h >>> 8) % KEYGEN_PARTICLES.length];
            }
        }

        if (jitter && (rowIndex === 1 || rowIndex === 4) && chars[0] === " ") {
            chars[0] = rowIndex === 1 ? "#" : "'";
        }

        return chars.join("");
    });
}

export function createPassportLines({
    state,
    distortion,
    now = Date.now(),
}) {
    const tick = Math.floor(now / 160);
    const isDamaged = state === "fail" || state === "broken";
    const lines = isDamaged
        ? [
              "  _____/_____  ",
              " /  DENIED  /| ",
              "/ PASSPORT / | ",
              "|----X-----| | ",
              "|          | | ",
              "|   ./-.   | | ",
              "|  / /# \\  | | ",
              "| |  X/ | | | ",
              "|  \\__X/  | | ",
              "|          | | ",
              "|  STAMP:X | | ",
              "|  DOC:##  | | ",
              "|          | / ",
              "|____/_____|/  ",
          ]
        : [
              "  ___________  ",
              " /          /| ",
              "/ PASSPORT / | ",
              "|----------| | ",
              "|          | | ",
              "|   .--.   | | ",
              "|  / /\\ \\  | | ",
              "| | <\\/> | | | ",
              "|  \\____/  | | ",
              "|          | | ",
              "|  TRAVEL  | | ",
              "|  DOC:**  | | ",
              "|          | / ",
              "|__________|/  ",
          ];

    return lines.map((line, rowIndex) => {
        const chars = padPlayerLine(line, PASSPORT_WIDTH).split("");

        if (distortion > 0 && (tick + rowIndex) % 11 === 0 && chars[0] === " ") {
            chars[0] = rowIndex % 2 ? "." : "'";
        }

        return chars.join("");
    });
}

export function createPasswordKeyLines({
    state,
    distortion,
    now = Date.now(),
}) {
    const tick = Math.floor(now / 150);
    const isDamaged = state === "fail" || state === "broken";
    const lines = isDamaged
        ? [
              "       _/__       ",
              "      |  ?#|      ",
              "      | [/__      ",
              "      |  _/|      ",
              "      | |  '      ",
              "    x | |         ",
              "      | |   %     ",
              "      |/|         ",
              "   __/  /\\__      ",
              "  +----/------+   ",
              "  |  PVV1234  |   ",
              "  +-----\\-----+   ",
              "     #  0x  '     ",
          ]
        : [
              "       ____       ",
              "      |  __|      ",
              "      | [__       ",
              "      |  __|      ",
              "      | |         ",
              "      | |         ",
              "      | |         ",
              "      | |         ",
              "   __/   \\__      ",
              "  +-----------+   ",
              "  |  PVV1234  |   ",
              "  +-----------+   ",
              "      ' 0x '      ",
          ];

    return lines.map((line, rowIndex) => {
        const chars = padPlayerLine(line, PASSWORD_KEY_WIDTH).split("");

        if (distortion > 0.18 && (tick + rowIndex) % 7 === 0) {
            const col = hashCell(tick + rowIndex, rowIndex * 31) % chars.length;

            if (chars[col] === " ") {
                chars[col] = KEYGEN_PARTICLES[(tick + rowIndex) % KEYGEN_PARTICLES.length];
            }
        }

        return chars.join("");
    });
}

export function createPlayerLines({
    currentLevel,
    state,
    distortion,
    now = Date.now(),
}) {
    return currentLevel === 2
        ? createPasswordKeyLines({ state, distortion, now })
        : createPassportLines({ state, distortion, now });
}

export function createVoiceSignalLines({
    currentLevel,
    width,
    now = Date.now(),
}) {
    const tick = Math.floor(now / 120);
    const frames =
        currentLevel === 2
            ? [
                  ["        ^        ", "      ~~|~~      ", "    ~~~|||~~~    "],
                  ["       /|\\       ", "     ~~ | ~~     ", "   ~~~~|||~~~~   "],
                  ["        |        ", "     ~~/|\\~~     ", "  ~~~~||.||~~~~  "],
              ]
            : [
                  ["        ^        ", "      .~|~.      ", "    ~~~|||~~~    "],
                  ["       /|\\       ", "     ~~ | ~~     ", "   ~~~~|||~~~~   "],
                  ["        |        ", "      ~/|\\~      ", "  ~~~~||.||~~~~  "],
              ];

    return frames[tick % frames.length].map((line) => padPlayerLine(line, width));
}

export function drawPlayerCharacter(
    row,
    rowIndex,
    metrics,
    {
        currentLevel,
        state,
        distortion,
        signalUntil,
        now = Date.now(),
    },
) {
    const bounds = getPlayerBounds(metrics, currentLevel);
    const signalActive = now < signalUntil;
    const signalTop = bounds.top - KEYGEN_SIGNAL_ROWS;

    if (signalActive && rowIndex >= signalTop && rowIndex < bounds.top) {
        for (let i = 0; i < bounds.width; i += 1) {
            row[bounds.left + i] = " ";
        }

        const line =
            createVoiceSignalLines({
                currentLevel,
                width: bounds.width,
                now,
            })[rowIndex - signalTop] || "";

        for (let i = 0; i < line.length; i += 1) {
            if (line[i] !== " ") {
                row[bounds.left + i] = line[i];
            }
        }
    }

    if (rowIndex < bounds.top || rowIndex > bounds.bottom) {
        return;
    }

    for (let i = 0; i < bounds.width; i += 1) {
        row[bounds.left + i] = " ";
    }

    const tokenLine =
        createPlayerLines({
            currentLevel,
            state,
            distortion,
            now,
        })[rowIndex - bounds.top] || "";

    for (let i = 0; i < tokenLine.length; i += 1) {
        if (tokenLine[i] !== " ") {
            row[bounds.left + i] = tokenLine[i];
        }
    }
}

export function getPlayerCharClass({
    char,
    rowIndex,
    col,
    metrics,
    currentLevel,
    state,
    signalUntil,
    now = Date.now(),
}) {
    if (char === " ") {
        return "";
    }

    const bounds = getPlayerBounds(metrics, currentLevel);
    const signalTop = bounds.top - KEYGEN_SIGNAL_ROWS;

    if (
        now < signalUntil &&
        rowIndex >= signalTop &&
        rowIndex < bounds.top &&
        col >= bounds.left &&
        col <= bounds.right
    ) {
        return "keygen-character-wave";
    }

    if (
        rowIndex < bounds.top ||
        rowIndex > bounds.bottom ||
        col < bounds.left ||
        col > bounds.right
    ) {
        const cableTop = getLevel2CableRoadTop(metrics);

        return currentLevel === 2 &&
            rowIndex >= cableTop &&
            col >= metrics.laneLeft - 2 &&
            col <= metrics.laneRight + 2
            ? "undersea-cable-road"
            : "";
    }

    const isPasswordKey = currentLevel === 2;
    const playerRow = rowIndex - bounds.top;
    const playerCol = col - bounds.left;

    if (
        !isPasswordKey &&
        playerRow >= 5 &&
        playerRow <= 8 &&
        playerCol >= 3 &&
        playerCol <= 10
    ) {
        return "passport-character-emblem";
    }

    if (/[A-Z0-9?]/.test(char)) {
        return isPasswordKey ? "password-key-code" : "passport-character-code";
    }

    if (/[.%'x#]/i.test(char)) {
        return isPasswordKey
            ? "password-key-character"
            : "passport-character-particle";
    }

    if (isPasswordKey) {
        return "password-key-character password-key-character--" + state;
    }

    return "passport-character passport-character--" + state;
}
