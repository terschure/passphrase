export function collectFinalChunks(
    event,
    { onText = () => {}, onFinal = () => {}, shouldStop = () => false } = {},
) {
    const finalChunks = [];

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript;

        onText(text, result);

        if (result.isFinal) {
            const chunk = text.trim();
            finalChunks.push(chunk);
            onFinal(chunk, result);
        }

        if (shouldStop()) {
            finalChunks.length = 0;
            break;
        }
    }

    return finalChunks;
}

export function collectLiveTranscript(event, { transcriptWasWiped = false } = {}) {
    const liveResults = [];
    const liveStart = transcriptWasWiped ? event.resultIndex : 0;

    for (let i = liveStart; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript.trim();

        if (text) {
            liveResults.push(text);
        }
    }

    return liveResults.join(" ");
}
