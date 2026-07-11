export function createTalkbackGenerationCache(maxEntries = 32) {
    const entries = new Map();
    const limit = Math.max(1, Number(maxEntries) || 32);

    function createKey(endpoint, modelId, prompt) {
        return `${endpoint}\n${modelId}\n${prompt}`;
    }

    function get(endpoint, modelId, prompt) {
        const key = createKey(endpoint, modelId, prompt);
        const audioUrl = entries.get(key);

        if (!audioUrl) {
            return null;
        }

        entries.delete(key);
        entries.set(key, audioUrl);
        return audioUrl;
    }

    function set(endpoint, modelId, prompt, audioUrl) {
        if (!audioUrl) {
            return;
        }

        const key = createKey(endpoint, modelId, prompt);
        entries.delete(key);
        entries.set(key, audioUrl);

        while (entries.size > limit) {
            entries.delete(entries.keys().next().value);
        }
    }

    return {
        get,
        set,
        clear: () => entries.clear(),
        get size() {
            return entries.size;
        },
    };
}
