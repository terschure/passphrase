export function createRoadAnimation({
    render,
    frameMs = 90,
    requestFrame = requestAnimationFrame,
    cancelFrame = cancelAnimationFrame,
}) {
    let frameId = null;
    let lastRender = 0;

    function frame(timestamp) {
        frameId = requestFrame(frame);

        if (timestamp - lastRender < frameMs) {
            return;
        }

        lastRender = timestamp;
        render(timestamp);
    }

    return {
        start() {
            if (frameId) {
                return;
            }

            frameId = requestFrame(frame);
        },
        stop() {
            if (!frameId) {
                return;
            }

            cancelFrame(frameId);
            frameId = null;
        },
        reset() {
            lastRender = 0;
        },
        isRunning() {
            return Boolean(frameId);
        },
    };
}
