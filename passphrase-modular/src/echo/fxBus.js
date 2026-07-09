export function buildReverbImpulse(audioContext, { seconds, random = Math.random }) {
    const sampleRate = audioContext.sampleRate;
    const length = Math.round(sampleRate * seconds);
    const impulse = audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);

        for (let i = 0; i < length; i += 1) {
            data[i] = (random() * 2 - 1) * Math.pow(1 - i / length, 2.8);
        }
    }

    return impulse;
}

export function createEchoBus(
    audioContext,
    { gain, delayTime, reverbSeconds, random = Math.random },
) {
    const input = audioContext.createGain();
    const dry = audioContext.createGain();
    const delay = audioContext.createDelay(2);
    const delayFeedback = audioContext.createGain();
    const delaySend = audioContext.createGain();
    const delayWet = audioContext.createGain();
    const reverb = audioContext.createConvolver();
    const reverbSend = audioContext.createGain();
    const reverbWet = audioContext.createGain();
    const master = audioContext.createGain();

    reverb.buffer = buildReverbImpulse(audioContext, {
        seconds: reverbSeconds,
        random,
    });
    delay.delayTime.value = delayTime;

    input.connect(dry);
    dry.connect(master);

    input.connect(delaySend);
    delaySend.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(master);

    input.connect(reverbSend);
    delay.connect(reverbSend);
    reverbSend.connect(reverb);
    reverb.connect(reverbWet);
    reverbWet.connect(master);

    dry.gain.value = 1;
    delaySend.gain.value = 0;
    delayFeedback.gain.value = 0.25;
    delayWet.gain.value = 0.9;
    reverbSend.gain.value = 0;
    reverbWet.gain.value = 1;
    master.gain.value = gain;

    master.connect(audioContext.destination);

    return {
        input,
        dry,
        delaySend,
        delayFeedback,
        reverbSend,
        master,
    };
}

export function updateEchoBus(bus, audioContext, progress) {
    const now = audioContext.currentTime;
    bus.dry.gain.setTargetAtTime(1 - progress * 0.35, now, 0.2);
    bus.delaySend.gain.setTargetAtTime(progress * 0.7, now, 0.2);
    bus.delayFeedback.gain.setTargetAtTime(0.25 + progress * 0.35, now, 0.2);
    bus.reverbSend.gain.setTargetAtTime(progress * 0.8, now, 0.2);
}

export function disconnectEchoBus(bus) {
    try {
        bus?.master.disconnect();
    } catch (error) {
        // The owning AudioContext may already be closed.
    }
}
