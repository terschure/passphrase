import { hashCell } from "./hash.js";

const PLANT_CHARS = [".", ",", "'", '"', "*", "v", "w"];
const WALL_FIRE_SPOT_CHARS = ["*", "+", "o"];
const WALL_BRICK_SIDE_WIDTH = 12;
const WALL_MIN_WIDTH = 48;
const WALL_WORD_PADDING = 28;
const FENCE_WIRE_HEIGHT = 4;
const FENCE_WIRE_OVERHANG = 0;
const FENCE_PRESSURE_CHARS = ["*", "'", ".", "#", "!"];
const BUBBLE_WALL_CHARS = ["o", "O", "0", "°", ".", "○", "o", "O"];
const LEVEL_2_CABLE_PATTERNS = ["|:", ":|", "#|", "0|", "~|", "+|"];
const LEVEL_3_ALERT_FRAGMENTS = [
    "VOICE DUPLICATED",
    "OWNERSHIP REVOKED",
    "SYNTHETIC ID ACTIVE",
    "ACCESS DENIED",
    "VOICEPRINT LOCKED",
    "CLONE ACTIVE",
    "IDENTITY SPLIT",
];

export const WALL_FIRE_FRAMES = [
    [
        "   ^    ' /\\   W    ^^    ' /\\   ",
        "  /|\\    /V \\  |   /||\\    /M \\  ",
        " //|\\\\  / /\\ \\ |  //||\\\\  / /\\ \\ ",
        "/\\/ \\/\\/ /  \\ \\|/\\/ /||\\ \\/\\/~ \\",
    ],
    [
        "  /\\   '   ^^    M   /\\     ^    ",
        " /||\\     /  \\   |  /|\\    /|\\   ",
        "/ || \\   //\\  \\  V / | \\  //|\\\\  ",
        "\\/  \\/\\/ /  \\/\\/\\/  |  \\/\\/~| \\",
    ],
    [
        "   ^^    W  /\\   '   ^    M  /\\   ",
        "  /  \\   | /||\\     /|\\   | /||\\  ",
        " / /\\ \\  V// ||\\   //|\\\\  V// ||\\ ",
        "/ /  \\ \\/\\/  || \\/\\/ | \\/\\/  ||~\\",
    ],
];

export const WALL_FIRE_HEIGHT = 4;
export const WALL_HEIGHT = 15;
export const WALL_WORD_ROW = 10;
export const GATE_ANIM_MS = 900;

export function groundProp(worldRow, col) {
    const h = hashCell(worldRow, col);

    if (h % 211 === 0) {
        return "|";
    }

    for (let dc = -1; dc <= 1; dc += 1) {
        if (hashCell(worldRow + 1, col + dc) % 211 === 0) {
            return "*";
        }
    }

    if (h % 29 === 0) {
        return PLANT_CHARS[(h >>> 8) % PLANT_CHARS.length];
    }

    return " ";
}

export function underseaProp(worldRow, col) {
    const h = hashCell(worldRow * 3, col * 11);

    if (h % 149 === 0) {
        return "o";
    }

    if (h % 61 === 0) {
        return ".";
    }

    if (h % 97 === 0) {
        return "~";
    }

    return " ";
}

export function getLevel2CableRoadTop() {
    return 0;
}

export function renderLevel2CableRoad(row, rowIndex, metrics, now = Date.now()) {
    const cableTop = getLevel2CableRoadTop(metrics);

    if (rowIndex < cableTop) {
        return;
    }

    const movement = Math.floor(now / 240);

    for (let col = metrics.laneLeft - 2; col <= metrics.laneRight + 2; col += 1) {
        const localCol = col - (metrics.laneLeft - 2);
        const cableSpacing = 4;
        const stripIndex = Math.floor(localCol / cableSpacing);
        const pattern =
            LEVEL_2_CABLE_PATTERNS[stripIndex % LEVEL_2_CABLE_PATTERNS.length];

        if (localCol % cableSpacing !== 0) {
            row[col] = " ";
        } else {
            row[col] =
                pattern[(rowIndex - cableTop + movement + stripIndex) % pattern.length];
        }
    }
}

export function renderLevel3SignalField(row, rowIndex, metrics, now = Date.now()) {
    const movement = Math.floor(now / 300);

    for (let col = metrics.laneLeft - 2; col <= metrics.laneRight + 2; col += 1) {
        const h = hashCell(rowIndex * 23 + movement, col * 37);

        if (h % 13 === 0) {
            row[col] = h % 2 ? "1" : "0";
        } else if (h % 29 === 0) {
            row[col] = "/";
        } else if (h % 31 === 0) {
            row[col] = "\\";
        } else if (col % 9 === movement % 9) {
            row[col] = "|";
        } else {
            row[col] = " ";
        }
    }
}

export function getWallBounds(word, laneLeft, laneRight) {
    const laneWidth = laneRight - laneLeft + 1;
    const wallWidth = Math.min(
        laneWidth,
        Math.max(WALL_MIN_WIDTH, word.length + WALL_WORD_PADDING),
    );
    const center = Math.floor((laneLeft + laneRight) / 2);
    const wallLeft = Math.max(laneLeft, center - Math.floor(wallWidth / 2));

    return {
        wallLeft,
        wallRight: Math.min(laneRight, wallLeft + wallWidth - 1),
    };
}

export function createScaryFireFrames(width, now = Date.now()) {
    return WALL_FIRE_FRAMES.map((frame) =>
        frame.map((line, rowIndex) => {
            let expanded = line;

            while (expanded.length < width + line.length) {
                expanded += line;
            }

            const sway = (rowIndex * 5 + Math.floor(now / 180)) % line.length;
            return expanded.slice(sway, sway + width);
        }),
    );
}

export function getCurrentFireFrame(width, now = Date.now()) {
    const frames = createScaryFireFrames(width, now);
    const index = Math.floor(now / 160) % frames.length;
    return frames[index];
}

function shouldRenderWallBricks(rowOffset) {
    return (
        rowOffset > WALL_FIRE_HEIGHT &&
        rowOffset < WALL_HEIGHT - 1 &&
        Math.abs(rowOffset - WALL_WORD_ROW) > 2
    );
}

function createBrickSidePattern(rowOffset, sideWidth, mirrored) {
    const patterns = mirrored
        ? ["--==--==--==", "==--==--==--"]
        : ["==--==--==--", "--==--==--=="];
    const pattern = patterns[rowOffset % patterns.length];
    let output = "";

    while (output.length < sideWidth) {
        output += pattern;
    }

    return output.slice(0, sideWidth);
}

function repeatObstaclePattern(pattern, width, offset = 0) {
    let repeated = pattern;

    while (repeated.length < width + pattern.length) {
        repeated += pattern;
    }

    return repeated.slice(offset % pattern.length, offset + width);
}

function createBarbedWireLine(width, rowOffset) {
    const patterns = [
        "  __o__    __o__ ",
        "_/     \\__/     \\",
        "  @-@-@-@-@-@-@  ",
        "\\__   __/\\__   __",
    ];
    return repeatObstaclePattern(patterns[rowOffset % patterns.length], width, 0);
}

export function getFenceBodyBounds(bounds) {
    return {
        wallLeft: Math.min(
            bounds.wallRight - 2,
            bounds.wallLeft + FENCE_WIRE_OVERHANG,
        ),
        wallRight: Math.max(
            bounds.wallLeft + 2,
            bounds.wallRight - FENCE_WIRE_OVERHANG,
        ),
    };
}

export function fillBubbleWallRow(row, rowOffset, bounds) {
    const width = bounds.wallRight - bounds.wallLeft + 1;
    const bodyBounds = getFenceBodyBounds(bounds);

    for (let col = bounds.wallLeft; col <= bounds.wallRight; col += 1) {
        const localCol = col - bounds.wallLeft;
        const h = hashCell(rowOffset * 41 + localCol * 17, col * 13);
        const isSide =
            col === bodyBounds.wallLeft || col === bodyBounds.wallRight;
        const isRail =
            rowOffset === FENCE_WIRE_HEIGHT || rowOffset === WALL_HEIGHT - 1;
        const cleanWordBand = Math.abs(rowOffset - WALL_WORD_ROW) <= 1;

        if (col < bodyBounds.wallLeft || col > bodyBounds.wallRight) {
            row[col] = " ";
        } else if (isRail) {
            row[col] = isSide ? "O" : BUBBLE_WALL_CHARS[(localCol + rowOffset) % BUBBLE_WALL_CHARS.length];
        } else if (isSide) {
            row[col] = "O";
        } else if (cleanWordBand) {
            row[col] = " ";
        } else {
            row[col] = BUBBLE_WALL_CHARS[
                (h + localCol + rowOffset) % BUBBLE_WALL_CHARS.length
            ];
        }
    }
}

export function fillChainLinkFenceRow(row, rowOffset, bounds, { pressure = 0, now = Date.now() } = {}) {
    const width = bounds.wallRight - bounds.wallLeft + 1;
    const bodyBounds = getFenceBodyBounds(bounds);
    const wireLine =
        rowOffset < FENCE_WIRE_HEIGHT ? createBarbedWireLine(width, rowOffset) : "";
    const pressureStep = Math.floor(now / 110);

    for (let col = bounds.wallLeft; col <= bounds.wallRight; col += 1) {
        const localCol = col - bounds.wallLeft;
        const h = hashCell(rowOffset * 53 + localCol * 19, pressureStep);
        const isSide =
            col === bodyBounds.wallLeft || col === bodyBounds.wallRight;
        const isRail =
            rowOffset === FENCE_WIRE_HEIGHT || rowOffset === WALL_HEIGHT - 1;
        const cleanWordBand = Math.abs(rowOffset - WALL_WORD_ROW) <= 1;
        const localStatic =
            pressure > 0.18 &&
            !cleanWordBand &&
            h % Math.max(4, Math.round(16 - pressure * 9)) === 0;
        const checkpointStamp =
            pressure > 0.45 &&
            (rowOffset === WALL_WORD_ROW - 3 || rowOffset === WALL_WORD_ROW + 3) &&
            localCol > 2 &&
            localCol < width - 3 &&
            localCol % 9 === pressureStep % 9;

        if (rowOffset < FENCE_WIRE_HEIGHT) {
            row[col] =
                localStatic && h % 3 === 0
                    ? FENCE_PRESSURE_CHARS[h % FENCE_PRESSURE_CHARS.length]
                    : wireLine[localCol] || " ";
        } else if (col < bodyBounds.wallLeft || col > bodyBounds.wallRight) {
            row[col] = " ";
        } else if (isRail) {
            row[col] = isSide ? "+" : "-";
        } else if (isSide) {
            row[col] = "|";
        } else if (cleanWordBand) {
            row[col] = " ";
        } else if (checkpointStamp) {
            row[col] = h % 2 ? "X" : "!";
        } else if (localStatic) {
            row[col] = FENCE_PRESSURE_CHARS[h % FENCE_PRESSURE_CHARS.length];
        } else {
            const shake = pressure > 0.35 && h % 11 === 0 ? 1 : 0;
            const mesh = (localCol + rowOffset + shake) % 4;
            row[col] = mesh === 0 ? "/" : mesh === 2 ? "\\" : " ";
        }
    }
}

export function fillDigitalFirewallRow(
    row,
    rowIndex,
    rowOffset,
    bounds,
    word,
    scroll,
    fireFrame,
) {
    for (let col = bounds.wallLeft; col <= bounds.wallRight; col += 1) {
        const h = hashCell(rowIndex + col * 17, scroll);
        const fireCol = col - bounds.wallLeft;
        const isBorder =
            col === bounds.wallLeft ||
            col === bounds.wallRight ||
            rowOffset === WALL_FIRE_HEIGHT ||
            rowOffset === WALL_HEIGHT - 1;
        const sideBrickWidth = Math.min(
            WALL_BRICK_SIDE_WIDTH,
            Math.floor((bounds.wallRight - bounds.wallLeft - word.length - 8) / 2),
        );
        const leftBrickStart = bounds.wallLeft + 2;
        const rightBrickStart = bounds.wallRight - sideBrickWidth - 1;
        const isLeftBrick =
            shouldRenderWallBricks(rowOffset) &&
            col >= leftBrickStart &&
            col < leftBrickStart + sideBrickWidth;
        const isRightBrick =
            shouldRenderWallBricks(rowOffset) &&
            col >= rightBrickStart &&
            col < rightBrickStart + sideBrickWidth;
        const isFireSpot = rowOffset === WALL_FIRE_HEIGHT + 1 && h % 23 === 0;

        if (rowOffset < WALL_FIRE_HEIGHT) {
            row[col] = fireFrame[rowOffset][fireCol] || " ";
        } else if (isFireSpot) {
            row[col] = WALL_FIRE_SPOT_CHARS[(h >>> 9) % WALL_FIRE_SPOT_CHARS.length];
        } else if (isBorder) {
            row[col] =
                rowOffset === WALL_FIRE_HEIGHT || rowOffset === WALL_HEIGHT - 1
                    ? rowOffset === WALL_FIRE_HEIGHT
                        ? "="
                        : "#"
                    : "#";
        } else if (isLeftBrick && sideBrickWidth > 0) {
            row[col] =
                createBrickSidePattern(rowOffset, sideBrickWidth, false)[
                    col - leftBrickStart
                ] || " ";
        } else if (isRightBrick && sideBrickWidth > 0) {
            row[col] =
                createBrickSidePattern(rowOffset, sideBrickWidth, true)[
                    col - rightBrickStart
                ] || " ";
        } else {
            row[col] = " ";
        }
    }
}

export function fillVoiceTheftTerminalRow(row, rowIndex, rowOffset, bounds, word) {
    const width = bounds.wallRight - bounds.wallLeft + 1;
    const cleanWordBand = Math.abs(rowOffset - WALL_WORD_ROW) <= 1;
    const fragment =
        LEVEL_3_ALERT_FRAGMENTS[rowOffset % LEVEL_3_ALERT_FRAGMENTS.length];

    for (let col = bounds.wallLeft; col <= bounds.wallRight; col += 1) {
        const localCol = col - bounds.wallLeft;
        const h = hashCell(rowIndex * 47 + localCol * 11, word.length * 19);
        const isLeft = col === bounds.wallLeft;
        const isRight = col === bounds.wallRight;
        const isTop = rowOffset === 0;
        const isBottom = rowOffset === WALL_HEIGHT - 1;
        const isHeader = rowOffset === 2 || rowOffset === WALL_HEIGHT - 3;

        if (isTop || isBottom) {
            row[col] = isLeft || isRight ? "+" : h % 7 === 0 ? "=" : "-";
        } else if (isLeft || isRight) {
            row[col] = "|";
        } else if (cleanWordBand) {
            row[col] = " ";
        } else if (isHeader) {
            const label = ` ${fragment} `;
            const start = Math.max(1, Math.floor((width - label.length) / 2));
            const labelIndex = localCol - start;
            row[col] =
                labelIndex >= 0 && labelIndex < label.length
                    ? label[labelIndex]
                    : h % 5 === 0
                      ? "#"
                      : "=";
        } else if (h % 17 === 0) {
            row[col] = h % 2 ? "1" : "0";
        } else if (h % 23 === 0) {
            row[col] = h % 3 ? "/" : "\\";
        } else if (h % 11 === 0) {
            row[col] = "_";
        } else {
            row[col] = " ";
        }
    }
}

export function getFenceCharClass(char, rowOffset, col, bounds) {
    if (char === " ") {
        return "";
    }

    if (Math.abs(rowOffset - WALL_WORD_ROW) <= 1 && /[A-Z0-9'.]/.test(char)) {
        return "fence-word";
    }

    if (rowOffset < FENCE_WIRE_HEIGHT) {
        return "fence-wire";
    }

    const bodyBounds = getFenceBodyBounds(bounds);

    if (
        col === bodyBounds.wallLeft ||
        col === bodyBounds.wallRight ||
        rowOffset === FENCE_WIRE_HEIGHT ||
        rowOffset === WALL_HEIGHT - 1
    ) {
        return "fence-border";
    }

    return "fence-mesh";
}

export function getBubbleWallCharClass(char, rowOffset, col, bounds) {
    if (char === " ") {
        return "";
    }

    if (Math.abs(rowOffset - WALL_WORD_ROW) <= 1 && /[A-Z0-9'.]/.test(char)) {
        return "bubble-word";
    }

    const bodyBounds = getFenceBodyBounds(bounds);

    if (
        col === bodyBounds.wallLeft ||
        col === bodyBounds.wallRight ||
        rowOffset === 0 ||
        rowOffset === WALL_HEIGHT - 1
    ) {
        return "bubble-border";
    }

    return "bubble-mesh";
}

export function getVoiceTheftCharClass(char, rowOffset, col, bounds) {
    if (char === " ") {
        return "";
    }

    if (Math.abs(rowOffset - WALL_WORD_ROW) <= 1 && /[A-Z0-9'. ]/.test(char)) {
        return "terminal-word";
    }

    if (
        col === bounds.wallLeft ||
        col === bounds.wallRight ||
        rowOffset === 0 ||
        rowOffset === WALL_HEIGHT - 1
    ) {
        return "terminal-border";
    }

    if (/[A-Z]/.test(char)) {
        return "terminal-alert";
    }

    if (/[01#/_=+\\-]/.test(char)) {
        return "terminal-noise";
    }

    return "terminal-body";
}

export function getWallCharClass(char, rowOffset, col, bounds) {
    if (char === " ") {
        return "";
    }

    if (Math.abs(rowOffset - WALL_WORD_ROW) <= 1 && /[A-Z0-9'. ]/.test(char)) {
        return "wall-word";
    }

    if (
        rowOffset < WALL_FIRE_HEIGHT ||
        char === "^" ||
        char === "/" ||
        char === "\\" ||
        char === "|" ||
        char === "v" ||
        char === "W" ||
        char === "M"
    ) {
        return "wall-fire-top";
    }

    if (char === "*" || char === "+" || char === "o") {
        return "wall-fire-spot";
    }

    if (char === "=" || char === "-") {
        return "wall-brick";
    }

    if (col === bounds.wallLeft || col === bounds.wallRight) {
        return "wall-border";
    }

    if (rowOffset === WALL_FIRE_HEIGHT || rowOffset === WALL_HEIGHT - 1) {
        return "wall-border";
    }

    return "wall-body";
}
