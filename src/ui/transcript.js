export function renderTranscript({
    finalText,
    interimText,
    gameOverTranscript,
    text,
    words,
    escapeRegExp,
    colorSpan,
}) {
    interimText.textContent = "";
    renderTranscriptInto({
        container: finalText,
        text,
        words,
        escapeRegExp,
        colorSpan,
    });
    renderTranscriptInto({
        container: gameOverTranscript,
        text,
        words,
        escapeRegExp,
        colorSpan,
    });
}

export function renderTranscriptInto({
    container,
    text,
    words,
    escapeRegExp,
    colorSpan,
}) {
    container.replaceChildren();

    if (!text || !words.length) {
        container.textContent = text;
        return;
    }

    const matcher = new RegExp(
        `\\b(?:${words
            .slice()
            .sort((a, b) => b.length - a.length)
            .map(escapeRegExp)
            .join("|")})\\b`,
        "gi",
    );
    let last = 0;

    for (const match of text.matchAll(matcher)) {
        if (match.index > last) {
            container.append(text.slice(last, match.index));
        }

        container.append(colorSpan("hit", match[0]));
        last = match.index + match[0].length;
    }

    container.append(text.slice(last));
}
