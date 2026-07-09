import { hashCell } from "./hash.js";
import {
    fillChainLinkFenceRow,
    fillDigitalFirewallRow,
    getCurrentFireFrame,
    getFenceBodyBounds,
    getFenceCharClass,
    getWallBounds,
    getWallCharClass,
    groundProp,
    renderLevel2CableRoad,
    underseaProp,
    WALL_HEIGHT,
    WALL_WORD_ROW,
} from "./roadScene.js";
import {
    drawPlayerCharacter,
    getPlayerCharClass,
} from "./player.js";

const SPARKLE_CHARS = ["*", "+", "'", ".", "o"];

function createSpan(doc, className, text) {
    const span = doc.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
}

function appendClassedText(fragment, doc, className, text) {
    if (className) {
        fragment.append(createSpan(doc, className, text));
    } else {
        fragment.append(doc.createTextNode(text));
    }
}

export function renderRoadScene({
    timeline,
    doc = document,
    word,
    wallRow,
    gateProgress = null,
    metrics,
    environment,
    playerState,
    now = Date.now(),
}) {
    const { laneLeft, laneRight } = metrics;
    const rows = buildRoadRows({
        word,
        wallRow,
        gateProgress,
        metrics,
        environment,
        playerState,
        now,
    });
    const fragment = doc.createDocumentFragment();
    const tick = Math.floor(now / 120);
    const isFenceLevel = environment === "border-fence";

    rows.forEach((row, r) => {
        const mid = row.slice(laneLeft - 1, laneRight + 2);
        const isObstacleRow = word && r >= wallRow && r < wallRow + WALL_HEIGHT;
        const isGateRow =
            isObstacleRow && gateProgress !== null && r >= wallRow;

        fragment.append(
            createSpan(doc, "ground", row.slice(0, laneLeft - 1)),
            isGateRow
                ? createSpan(doc, `gate-${(tick + r) % 4}`, mid)
                : isObstacleRow
                  ? isFenceLevel
                      ? renderChainLinkFence({
                            doc,
                            row,
                            rowIndex: r,
                            word,
                            wallRow,
                            metrics,
                        })
                      : renderBurningWall({
                            doc,
                            row,
                            rowIndex: r,
                            word,
                            wallRow,
                            metrics,
                        })
                  : renderRoadMiddle({
                        doc,
                        row,
                        rowIndex: r,
                        metrics,
                        environment,
                        playerState,
                        now,
                    }),
            createSpan(doc, "ground", row.slice(laneRight + 2)),
            doc.createTextNode("\n"),
        );
    });

    timeline.replaceChildren(fragment);
}

export function buildRoadRows({
    word,
    wallRow,
    gateProgress = null,
    metrics,
    environment,
    playerState,
    now = Date.now(),
}) {
    const { width, height, laneLeft, laneRight } = metrics;
    const isUndersea = environment === "undersea-cable";
    const rows = [];
    const scroll = Math.floor(now / 400);
    const wallBounds = word
        ? getWallBounds(word.toUpperCase(), laneLeft, laneRight)
        : null;
    const labelRow = wallRow + WALL_WORD_ROW;
    const fireFrame = wallBounds
        ? getCurrentFireFrame(wallBounds.wallRight - wallBounds.wallLeft + 1, now)
        : null;

    for (let r = 0; r < height; r += 1) {
        const row = Array(width).fill(" ");
        const worldRow = r - scroll;

        for (let c = 0; c < width; c += 1) {
            if (c < laneLeft - 2 || c > laneRight + 2) {
                row[c] = isUndersea
                    ? underseaProp(worldRow, c)
                    : groundProp(worldRow, c);
            }
        }

        if (isUndersea) {
            renderLevel2CableRoad(row, r, metrics, now);
        } else {
            row[laneLeft - 1] = "|";
            row[laneRight + 1] = "|";

            if (((worldRow % 4) + 4) % 4 < 2) {
                row[Math.floor((laneLeft + laneRight) / 2)] = ":";
            }
        }

        if (word && r >= wallRow && r < wallRow + WALL_HEIGHT && wallBounds) {
            const rowOffset = r - wallRow;
            if (isUndersea) {
                fillDigitalFirewallRow(
                    row,
                    r,
                    rowOffset,
                    wallBounds,
                    word,
                    scroll,
                    fireFrame,
                );
            } else {
                fillChainLinkFenceRow(row, rowOffset, wallBounds);
            }
        }

        if (word && r === labelRow && wallBounds) {
            renderWallLabel(row, {
                word,
                wallBounds,
                isUndersea,
            });
        }

        if (
            word &&
            gateProgress !== null &&
            r >= wallRow &&
            r < wallRow + WALL_HEIGHT &&
            wallBounds
        ) {
            renderGateGap(row, {
                rowIndex: r,
                wallBounds,
                gateProgress,
                now,
            });
        }

        drawPlayerCharacter(row, r, metrics, {
            environment,
            ...playerState,
            now,
        });

        rows.push(row.join(""));
    }

    return rows;
}

function renderWallLabel(row, { word, wallBounds, isUndersea }) {
    const labelBounds = isUndersea
        ? wallBounds
        : getFenceBodyBounds(wallBounds);
    const rawLabel = word.toUpperCase();
    const spacedLabel = rawLabel.split("").join(" ");
    const label =
        spacedLabel.length <= labelBounds.wallRight - labelBounds.wallLeft - 3
            ? spacedLabel
            : rawLabel;
    const start = Math.min(
        labelBounds.wallRight - label.length - 1,
        Math.max(
            labelBounds.wallLeft + 1,
            Math.floor(
                (labelBounds.wallLeft + labelBounds.wallRight - label.length) /
                    2,
            ),
        ),
    );

    for (let c = labelBounds.wallLeft; c <= labelBounds.wallRight; c += 1) {
        row[c] =
            c === labelBounds.wallLeft || c === labelBounds.wallRight
                ? isUndersea
                    ? "#"
                    : "|"
                : " ";
    }

    for (
        let i = 0;
        i < label.length && start + i <= labelBounds.wallRight;
        i += 1
    ) {
        row[start + i] = label[i];
    }
}

function renderGateGap(row, { rowIndex, wallBounds, gateProgress, now }) {
    const center = Math.floor((wallBounds.wallLeft + wallBounds.wallRight) / 2);
    const gap = Math.ceil(
        (gateProgress * (wallBounds.wallRight - wallBounds.wallLeft + 2)) / 2,
    );
    const tick = Math.floor(now / 120);

    for (let c = wallBounds.wallLeft; c <= wallBounds.wallRight; c += 1) {
        if (Math.abs(c - center) >= gap) {
            continue;
        }

        const h = hashCell(c * 31 + rowIndex, tick);
        row[c] =
            gateProgress < 1 && h % 3 === 0
                ? SPARKLE_CHARS[(h >>> 8) % SPARKLE_CHARS.length]
                : " ";
    }
}

function renderRoadMiddle({
    doc,
    row,
    rowIndex,
    metrics,
    environment,
    playerState,
    now,
}) {
    const { laneLeft, laneRight } = metrics;
    const fragment = doc.createDocumentFragment();
    let currentClass = null;
    let buffer = "";

    function flush() {
        if (!buffer) {
            return;
        }

        appendClassedText(fragment, doc, currentClass, buffer);
        buffer = "";
    }

    for (let col = laneLeft - 1; col <= laneRight + 1; col += 1) {
        const char = row[col] || " ";
        const className = getPlayerCharClass({
            char,
            rowIndex,
            col,
            metrics,
            environment,
            ...playerState,
            now,
        });

        if (className !== currentClass) {
            flush();
            currentClass = className;
        }

        buffer += char;
    }

    flush();
    return fragment;
}

function renderBurningWall({ doc, row, rowIndex, word, wallRow, metrics }) {
    const { laneLeft, laneRight } = metrics;
    const bounds = getWallBounds(word, laneLeft, laneRight);
    const rowOffset = rowIndex - wallRow;
    const fragment = doc.createDocumentFragment();
    let currentClass = null;
    let buffer = "";

    function flush() {
        if (!buffer) {
            return;
        }

        appendClassedText(fragment, doc, currentClass, buffer);
        buffer = "";
    }

    for (let col = laneLeft - 1; col <= laneRight + 1; col += 1) {
        const char = row[col] || " ";
        const className =
            col >= bounds.wallLeft && col <= bounds.wallRight
                ? getWallCharClass(char, rowOffset, col, bounds)
                : "";

        if (className !== currentClass) {
            flush();
            currentClass = className;
        }

        buffer += char;
    }

    flush();
    return fragment;
}

function renderChainLinkFence({ doc, row, rowIndex, word, wallRow, metrics }) {
    const { laneLeft, laneRight } = metrics;
    const bounds = getWallBounds(word, laneLeft, laneRight);
    const rowOffset = rowIndex - wallRow;
    const fragment = doc.createDocumentFragment();
    let currentClass = null;
    let buffer = "";

    function flush() {
        if (!buffer) {
            return;
        }

        appendClassedText(fragment, doc, currentClass, buffer);
        buffer = "";
    }

    for (let col = laneLeft - 1; col <= laneRight + 1; col += 1) {
        const char = row[col] || " ";
        const className =
            col >= bounds.wallLeft && col <= bounds.wallRight
                ? getFenceCharClass(char, rowOffset, col, bounds)
                : "";

        if (className !== currentClass) {
            flush();
            currentClass = className;
        }

        buffer += char;
    }

    flush();
    return fragment;
}
