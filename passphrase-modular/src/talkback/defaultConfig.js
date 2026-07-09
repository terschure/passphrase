export const TALKBACK_RUNTIME_CONFIG = {
    modelId: "qwen3-tts-0.6b-base",
    minRefSeconds: 5,
    targetRefSeconds: 12,
    maxSegments: 16,
    cooldownMs: 12000,
    fetchTimeoutMs: 8000,
    generateTimeoutMs: 90000,
    minMs: 400,
    minRms: 0.01,
    trimRms: 0.02,
    trimPadMs: 60,
    probabilities: {
        beat: 0.2,
        wall: 0.25,
        life: 0.45,
        random: 0.12,
    },
};
