export function getWaveformAmplitude(timeDomainData) {
    let total = 0;

    for (const value of timeDomainData) {
        const centered = (value - 128) / 128;
        total += centered * centered;
    }

    return Math.min(1, Math.sqrt(total / timeDomainData.length) * 3.5);
}

export function createMicrophoneVisualizer({
    navigatorRef = navigator,
    AudioContextClass = AudioContext,
    requestFrame = requestAnimationFrame,
    cancelFrame = cancelAnimationFrame,
    performanceRef = performance,
    onAmplitude,
    onIdleFrame,
    onSpectrum,
}) {
    let audioContext = null;
    let analyser = null;
    let micStream = null;
    let visualizerFrame = null;
    let idleVisualizerFrame = null;

    function stopIdle() {
        if (idleVisualizerFrame) {
            cancelFrame(idleVisualizerFrame);
            idleVisualizerFrame = null;
        }
    }

    function startIdle() {
        stopIdle();

        function draw(timestamp) {
            onIdleFrame(timestamp);
            idleVisualizerFrame = requestFrame(draw);
        }

        draw(performanceRef.now());
    }

    async function start() {
        if (
            !navigatorRef.mediaDevices ||
            !navigatorRef.mediaDevices.getUserMedia
        ) {
            return false;
        }

        stopIdle();
        micStream = await navigatorRef.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContextClass();
        // Best effort: some browsers create the context suspended until a
        // gesture. Resuming lets the spectrum react as soon as possible.
        audioContext.resume?.().catch(() => {});
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const source = audioContext.createMediaStreamSource(micStream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.fftSize);
        const freq = new Uint8Array(analyser.frequencyBinCount);

        function draw(timestamp) {
            visualizerFrame = requestFrame(draw);
            analyser.getByteTimeDomainData(data);
            onAmplitude(getWaveformAmplitude(data), timestamp);

            if (onSpectrum) {
                analyser.getByteFrequencyData(freq);
                onSpectrum(freq, timestamp);
            }
        }

        draw(performanceRef.now());
        return true;
    }

    function isActive() {
        return Boolean(micStream);
    }

    function stop() {
        if (visualizerFrame) {
            cancelFrame(visualizerFrame);
            visualizerFrame = null;
        }

        if (micStream) {
            for (const track of micStream.getTracks()) {
                track.stop();
            }
            micStream = null;
        }

        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }

        analyser = null;
        startIdle();
    }

    return {
        get audioContext() {
            return audioContext;
        },
        get micStream() {
            return micStream;
        },
        start,
        stop,
        startIdle,
        isActive,
    };
}
