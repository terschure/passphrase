export const ECHO_RUNTIME_CONFIG = {
  gain: 0.45,
  prerollMs: 600,
  cooldownMs: 4000,
  progressBoost: 1.5,
  cooldownFloor: 0.4,
  delayTime: 0.3,
  reverbSeconds: 2.6,
  minMs: 400,
  maxMs: 8000,
  minRms: 0.01,
  trimRms: 0.02,
  trimPadMs: 60,
  waveBuckets: 40,
  probabilities: { beat: 0.4, wall: 0.45, life: 0.85, random: 0.3 },
};

export function getPreferredEchoMimeType(MediaRecorderClass) {
  return MediaRecorderClass?.isTypeSupported?.("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "";
}
