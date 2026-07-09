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
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const source = audioContext.createMediaStreamSource(micStream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.fftSize);

        function draw(timestamp) {
            visualizerFrame = requestFrame(draw);
            analyser.getByteTimeDomainData(data);
            onAmplitude(getWaveformAmplitude(data), timestamp);
        }

        draw(performanceRef.now());
        return true;
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
    };
}
