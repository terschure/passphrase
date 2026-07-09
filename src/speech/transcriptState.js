export function createTranscriptState() {
    const finalChunks = [];
    let interimTranscript = "";
    let handlingRecognitionResult = false;
    let transcriptWipedDuringResult = false;
    let transcriptWasWiped = false;

    return {
        get finalChunks() {
            return finalChunks;
        },
        get interimTranscript() {
            return interimTranscript;
        },
        get transcriptWasWiped() {
            return transcriptWasWiped;
        },
        beginRecognitionResult() {
            handlingRecognitionResult = true;
            transcriptWipedDuringResult = false;
        },
        endRecognitionResult() {
            handlingRecognitionResult = false;
        },
        wasWipedDuringResult() {
            return transcriptWipedDuringResult;
        },
        appendFinal(chunk) {
            finalChunks.push(chunk);
        },
        setInterim(text) {
            interimTranscript = text;
        },
        clear() {
            finalChunks.length = 0;
            interimTranscript = "";
            transcriptWasWiped = true;

            if (handlingRecognitionResult) {
                transcriptWipedDuringResult = true;
            }
        },
        getSelected(source) {
            return source === "interim"
                ? interimTranscript
                : finalChunks.join(" ");
        },
    };
}
