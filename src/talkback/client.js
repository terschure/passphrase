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

function playTalkbackMediaElement({
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
        audio.volume = 1;
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

async function playTalkbackWebAudio({
    endpoint,
    audioUrl,
    prompt,
    audioContext,
    fetchAudio,
    onCreated,
    onPlay,
    onEnded,
}) {
    await audioContext.resume?.();

    const response = await fetchAudio(
        absolutizeTalkbackAudioUrl(endpoint, audioUrl),
    );

    if (!response.ok) {
        throw new Error(`audio ${response.status}`);
    }

    const bytes = await response.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(bytes);
    const source = audioContext.createBufferSource();
    source.buffer = decoded;
    source.connect(audioContext.destination);

    return new Promise((resolve) => {
        let finished = false;

        function finish(notifyEnded) {
            if (finished) {
                return;
            }

            finished = true;
            source.onended = null;

            if (notifyEnded) {
                onEnded?.(playback);
            }

            resolve(playback);
        }

        const playback = {
            pause() {
                try {
                    source.stop();
                } catch (error) {
                    // Source may already have ended.
                }
                finish(false);
            },
        };

        source.onended = () => finish(true);
        onCreated?.(playback);
        source.start();
        onPlay?.(prompt, playback);
    });
}

export async function playTalkbackAudio({
    endpoint,
    audioUrl,
    prompt,
    audioContext = null,
    fetchAudio = fetch,
    AudioClass = Audio,
    onCreated,
    onPlay,
    onEnded,
    onError,
}) {
    if (
        audioContext?.decodeAudioData &&
        audioContext?.createBufferSource &&
        fetchAudio
    ) {
        try {
            return await playTalkbackWebAudio({
                endpoint,
                audioUrl,
                prompt,
                audioContext,
                fetchAudio,
                onCreated,
                onPlay,
                onEnded,
            });
        } catch (error) {
            // Cross-origin/decode failures retain the media-element fallback.
        }
    }

    return playTalkbackMediaElement({
        endpoint,
        audioUrl,
        prompt,
        AudioClass,
        onCreated,
        onPlay,
        onEnded,
        onError,
    });
}
