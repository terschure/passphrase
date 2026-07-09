export async function uploadTalkbackReference({
    selected,
    refsUrl,
    fetchWithTimeout,
    timeoutMs,
}) {
    const form = new FormData();
    form.append(
        "audio",
        selected.blob,
        selected.blob.type === "audio/wav"
            ? "passphrase-reference.wav"
            : "passphrase-reference.webm",
    );
    form.append("transcript", selected.transcript);
    form.append("source", "recording");
    form.append("label", "passphrase talk-back");

    const response = await fetchWithTimeout(
        refsUrl,
        { method: "POST", body: form },
        timeoutMs,
    );

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`ref ${response.status}: ${detail}`);
    }

    return response.json();
}

export async function generateTalkbackAudioRecord({
    generateUrl,
    fetchWithTimeout,
    timeoutMs,
    modelId,
    prompt,
    refId,
}) {
    const response = await fetchWithTimeout(
        generateUrl,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model_id: modelId,
                prompt,
                ref_id: refId,
            }),
        },
        timeoutMs,
    );

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`generate ${response.status}: ${detail}`);
    }

    return response.json();
}

export function absolutizeTalkbackAudioUrl(endpoint, audioUrl) {
    if (/^https?:\/\//i.test(audioUrl)) {
        return audioUrl;
    }

    return `${endpoint}${audioUrl}`;
}

export function playTalkbackAudio({
    endpoint,
    audioUrl,
    prompt,
    AudioClass = Audio,
    onCreated,
    onPlay,
    onEnded,
    onError,
}) {
    return new Promise((resolve) => {
        const audio = new AudioClass(absolutizeTalkbackAudioUrl(endpoint, audioUrl));
        onCreated?.(audio);

        audio.onplay = () => {
            onPlay?.(prompt, audio);
        };
        audio.onended = () => {
            onEnded?.(audio);
            resolve(audio);
        };
        audio.onerror = () => {
            onError?.("playback failed", audio);
            resolve(audio);
        };

        audio.play().catch(() => {
            onError?.("playback blocked", audio);
            resolve(audio);
        });
    });
}
