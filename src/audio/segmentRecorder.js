export function startSegmentRecorder({
    stream,
    mimeType = "",
    MediaRecorderClass = MediaRecorder,
    discardFlag,
    labelField,
    defaultLabel = "",
    BlobClass = Blob,
    now = Date.now,
    onStop,
    onStartError,
}) {
    const chunks = [];
    const startedAt = now();
    const recorder = new MediaRecorderClass(
        stream,
        mimeType ? { mimeType } : undefined,
    );

    recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) {
            chunks.push(event.data);
        }
    };

    recorder.onstop = () => {
        if (recorder[discardFlag]) {
            return;
        }

        onStop({
            blob: new BlobClass(chunks, mimeType ? { type: mimeType } : {}),
            label: recorder[labelField] || defaultLabel,
            durationMs: now() - startedAt,
            recorder,
        });
    };

    try {
        recorder.start();
    } catch (error) {
        onStartError?.(error);
        return null;
    }

    return {
        recorder,
        startedAt,
    };
}

export function discardRecorder(recorder, discardFlag) {
    if (!recorder) {
        return;
    }

    recorder[discardFlag] = true;

    if (recorder.state === "recording") {
        try {
            recorder.stop();
        } catch (error) {
            // The recorder may already have stopped asynchronously.
        }
    }
}
