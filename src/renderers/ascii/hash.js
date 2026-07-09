export function hashCell(row, col) {
    let h = Math.imul(row, 374761393) + Math.imul(col, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}

export function getRoadMetricsFromViewport({
    viewportWidth,
    viewportHeight,
    charWidth,
    lineHeight,
}) {
    const width = Math.max(42, Math.ceil(viewportWidth / charWidth) + 12);
    const height = Math.max(24, Math.ceil(viewportHeight / lineHeight) + 2);
    const center = Math.floor(width / 2);
    const maxLanePixelWidth = Math.min(
        520,
        Math.max(280, viewportWidth - 32),
    );
    const lanePixelWidth = Math.min(
        Math.max(viewportWidth * 0.42, 320),
        maxLanePixelWidth,
    );
    const laneHalfWidth = Math.max(
        13,
        Math.floor(lanePixelWidth / charWidth / 2),
    );

    return {
        width,
        height,
        laneLeft: center - laneHalfWidth,
        laneRight: center + laneHalfWidth,
        carCol: center - 2,
        carRow: height - 13,
    };
}

export function obstacleIntersectsPlayer({ wallRow, wallHeight, playerBounds }) {
    const wallBottom = wallRow + wallHeight - 1;
    return wallBottom >= playerBounds.top;
}
