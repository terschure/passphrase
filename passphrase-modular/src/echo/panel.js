function createSpan(doc, className, text) {
    const span = doc.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
}

function drawSnippetWave(canvasEl, peaks, color) {
    const context = canvasEl.getContext("2d");
    const width = canvasEl.width;
    const height = canvasEl.height;
    const barWidth = width / peaks.length;
    context.clearRect(0, 0, width, height);
    context.fillStyle = color;

    for (const [i, peak] of peaks.entries()) {
        const barHeight = Math.max(1, peak * height);
        context.fillRect(
            i * barWidth,
            (height - barHeight) / 2,
            Math.max(1, barWidth - 1),
            barHeight,
        );
    }
}

export function renderEchoPanel({
    header,
    rows,
    progress,
    recorderActive,
    snippets,
    doc = document,
}) {
    header.textContent =
        progress > 0 ? `[ echo ] fx ${Math.round(progress * 100)}%` : "[ echo ]";
    rows.replaceChildren();

    if (recorderActive) {
        const recRow = doc.createElement("div");
        recRow.className = "echo-row";
        recRow.append(
            createSpan(doc, "echo-badge rec", "● REC"),
            createSpan(doc, "echo-label", "listening to you…"),
        );
        rows.append(recRow);
    }

    const visible = snippets.slice().reverse();

    for (const snippet of visible) {
        const row = doc.createElement("div");
        row.className = "echo-row";

        const wave = doc.createElement("canvas");
        wave.width = 64;
        wave.height = 16;
        drawSnippetWave(
            wave,
            snippet.peaks,
            snippet.state === "idle" ? "#666666" : "#facc15",
        );

        const rateLabel = snippet.rate ? ` ×${snippet.rate.toFixed(2)}` : "";
        const badge =
            snippet.state === "initiating"
                ? createSpan(doc, "echo-badge init", `INIT${rateLabel}`)
                : snippet.state === "playing"
                  ? createSpan(doc, "echo-badge play", `▶${rateLabel}`)
                  : createSpan(
                        doc,
                        "echo-badge muted",
                        `${snippet.buffer.duration.toFixed(1)}s`,
                    );

        row.append(wave, createSpan(doc, "echo-label", snippet.label), badge);
        rows.append(row);
    }
}
