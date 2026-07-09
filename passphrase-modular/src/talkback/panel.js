export function setTalkbackStatus(element, text, className = "") {
    element.textContent = text;
    element.className = ["talkback-value", className].filter(Boolean).join(" ");
}

export function renderTalkbackPanel({
    endpointStatus,
    referenceStatus,
    voiceStatus,
    enabled,
    ready,
    healthDetail,
    reference,
    selectedReference,
    segmentCount,
    threshold,
    progress,
    generating,
    playing,
}) {
    setTalkbackStatus(
        endpointStatus,
        enabled ? (ready ? "ready" : healthDetail) : "off",
        enabled ? (ready ? "ok" : "warn") : "",
    );

    const refText = reference
        ? `${reference.duration_s.toFixed(1)}s uploaded`
        : selectedReference
          ? `${selectedReference.duration.toFixed(1)}s captured`
          : `${segmentCount} clips`;
    setTalkbackStatus(
        referenceStatus,
        refText,
        reference || selectedReference ? "ok" : "",
    );

    const voiceText = generating
        ? "generating"
        : playing
          ? "playing"
          : `${progress}/${threshold}`;
    setTalkbackStatus(voiceStatus, voiceText, progress >= threshold ? "ok" : "");
}
