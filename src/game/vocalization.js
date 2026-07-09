// Detects a sustained non-word vocalization from the live mic amplitude
// stream (the same 0–1 value that drives the spectrum). It fires once when the
// amplitude has stayed at or above `threshold` for at least `minMs`, then
// "disarms" until the amplitude drops back below the threshold — so a single
// continuous sound cannot clear several sound-phrases in a row.
//
// Pure and browser-free: feed it `(amplitude, timestamp)` each frame.
export function createVocalizationDetector({ threshold, minMs }) {
    let activeSince = null;
    let armed = true;

    function reset() {
        activeSince = null;
        armed = true;
    }

    function sample(amplitude, timestamp) {
        if (amplitude < threshold) {
            // Below threshold: reset the timer and re-arm for the next sound.
            activeSince = null;
            armed = true;
            return false;
        }

        if (!armed) {
            // Already fired for this sound; wait for a dip before firing again.
            return false;
        }

        if (activeSince === null) {
            activeSince = timestamp;
            return false;
        }

        if (timestamp - activeSince >= minMs) {
            activeSince = null;
            armed = false;
            return true;
        }

        return false;
    }

    return { sample, reset };
}
