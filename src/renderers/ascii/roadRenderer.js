import { hashCell } from "./hash.js";
import {
    fillBubbleWallRow,
    fillChainLinkFenceRow,
    fillDigitalFirewallRow,
    fillVoiceTheftTerminalRow,
    getBubbleWallCharClass,
    getCurrentFireFrame,
    getFenceCharClass,
    getVoiceTheftCharClass,
    getWallBounds,
    getWallCharClass,
    groundProp,
    renderLevel2CableRoad,
    renderLevel3SignalField,
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
    const isBubbleLevel = environment === "bubble-wall" || environment === "border-fence";
    const isFenceLevel = environment === "chain-link";
    const isVoiceTheft = environment === "voice-theft";

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
                  ? isBubbleLevel
                      ? renderBubbleWall({
                            doc,
                            row,
                            rowIndex: r,
                            word,
                            wallRow,
                            metrics,
                        })
                      : isFenceLevel
                        ? renderChainLinkFence({
                            doc,
                            row,
                            rowIndex: r,
                            word,
                            wallRow,
                            metrics,
                        })
                        : isVoiceTheft
                        ? renderVoiceTheftTerminal({
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
    const hasUnderseaBackground =
        environment === "undersea-cable" || environment === "chain-link";
    const isBubbleLevel = environment === "bubble-wall" || environment === "border-fence";
    const isFenceLevel = environment === "chain-link";
    const isVoiceTheft = environment === "voice-theft";
    const isVoiceFirewall = environment === "voice-firewall";
    const isFirewallLevel = environment === "undersea-cable" || isVoiceFirewall;
    const rows = [];
    const scroll = Math.floor(now / 400);
    const wallBounds = word
        ? getWallBounds(word.toUpperCase(), laneLeft, laneRight)
        : null;
    const labelLines = wallBounds ? formatWallLabelLines(word, wallBounds) : [];
    const labelStartRow =
        wallRow + WALL_WORD_ROW - Math.floor((labelLines.length - 1) / 2);
    const fireFrame = wallBounds
        ? getCurrentFireFrame(wallBounds.wallRight - wallBounds.wallLeft + 1, now)
        : null;

    for (let r = 0; r < height; r += 1) {
        const row = Array(width).fill(" ");
        const worldRow = r - scroll;

        for (let c = 0; c < width; c += 1) {
            if (c < laneLeft - 2 || c > laneRight + 2) {
                row[c] = hasUnderseaBackground
                    ? underseaProp(worldRow, c)
                    : groundProp(worldRow, c);
            }
        }

        if (isVoiceTheft || isVoiceFirewall) {
            renderLevel3SignalField(row, r, metrics, now);
        } else if (hasUnderseaBackground) {
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
            if (isVoiceTheft) {
                fillVoiceTheftTerminalRow(row, r, rowOffset, wallBounds, word);
            } else if (isVoiceFirewall) {
                fillDigitalFirewallRow(
                    row,
                    r,
                    rowOffset,
                    wallBounds,
                    word,
                    scroll,
                    fireFrame,
                );
            } else if (hasUnderseaBackground) {
                if (isFenceLevel) {
                    fillChainLinkFenceRow(row, rowOffset, wallBounds, {
                        pressure: Math.min(
                            1,
                            Math.max(0, wallRow / Math.max(1, metrics.carRow - 1)),
                        ),
                        now,
                    });
                } else {
                    fillDigitalFirewallRow(
                        row,
                        r,
                        rowOffset,
                        wallBounds,
                        word,
                        scroll,
                        fireFrame,
                    );
                }
            } else {
                fillBubbleWallRow(row, rowOffset, wallBounds);
            }
        }

        if (
            word &&
            wallBounds &&
            r >= labelStartRow &&
            r < labelStartRow + labelLines.length
        ) {
            renderWallLabel(row, {
                label: labelLines[r - labelStartRow],
                wallBounds,
                isUndersea: isFirewallLevel,
                isVoiceTheft,
                isBubbleLevel,
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

export function formatWallLabelLines(text, wallBounds, maxLines = 2) {
    const maxWidth = Math.max(8, wallBounds.wallRight - wallBounds.wallLeft - 3);
    const rawLabel = String(text || "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
    const spacedLabel = rawLabel.split("").join(" ");

    if (spacedLabel.length <= maxWidth) {
        return [spacedLabel];
    }

    if (rawLabel.length <= maxWidth) {
        return [rawLabel];
    }

    const words = rawLabel.split(" ");
    const lines = [];
    let current = "";

    function truncate(line) {
        if (line.length <= maxWidth) {
            return line;
        }

        return maxWidth <= 3 ? line.slice(0, maxWidth) : `${line.slice(0, maxWidth - 3)}...`;
    }

    for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
        const word = words[wordIndex];
        const next = current ? `${current} ${word}` : word;

        if (next.length <= maxWidth) {
            current = next;
            continue;
        }

        if (current) {
            lines.push(current);
        }

        current = word.length > maxWidth ? truncate(word) : word;

        if (lines.length === maxLines - 1) {
            const remaining = [current, ...words.slice(wordIndex + 1)]
                .filter(Boolean)
                .join(" ");
            lines.push(truncate(remaining));
            return lines;
        }
    }

    if (current) {
        lines.push(current);
    }

    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines - 1);
        kept.push(truncate(lines.slice(maxLines - 1).join(" ")));
        return kept;
    }

    return lines;
}

function renderWallLabel(row, { label, wallBounds, isUndersea, isVoiceTheft, isBubbleLevel }) {
    const leftBorderChar = isUndersea ? "#" : isVoiceTheft ? "|" : isBubbleLevel ? "O" : "|";
    const rightBorderChar = leftBorderChar;
    const wallWidth = wallBounds.wallRight - wallBounds.wallLeft + 1;
    const labelRow = buildWallLabelRow({
        wallWidth,
        leftBorderChar,
        rightBorderChar,
        fillChar: " ",
        label,
    });

    for (let i = 0; i < wallWidth; i += 1) {
        row[wallBounds.wallLeft + i] = labelRow[i] || " ";
    }
}

function buildWallLabelRow({
    wallWidth,
    leftBorderChar,
    rightBorderChar,
    fillChar,
    label,
}) {
    const width = Math.max(2, Number(wallWidth) || 2);
    const chars = Array(width).fill(fillChar);
    const innerWidth = Math.max(0, width - 2);
    const safeLabel = String(label || "").slice(0, innerWidth);
    const start = 1 + Math.max(0, Math.floor((innerWidth - safeLabel.length) / 2));

    chars[0] = leftBorderChar;
    chars[width - 1] = rightBorderChar;

    for (let i = 0; i < safeLabel.length && i < innerWidth; i += 1) {
        chars[start + i] = safeLabel[i];
    }

    return chars.join("").slice(0, width).padEnd(width, fillChar);
}

function renderBubbleWall({ doc, row, rowIndex, word, wallRow, metrics }) {
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
                ? getBubbleWallCharClass(char, rowOffset, col, bounds)
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

function renderVoiceTheftTerminal({ doc, row, rowIndex, word, wallRow, metrics }) {
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
                ? getVoiceTheftCharClass(char, rowOffset, col, bounds)
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
