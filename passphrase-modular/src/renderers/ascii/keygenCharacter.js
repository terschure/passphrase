export function createKeygenCharacter({ now = () => Date.now() } = {}) {
    const character = {
        state: "idle",
        stateUntil: 0,
        signalUntil: 0,
        distortionLevel: 0,
    };

    function setState(state, durationMs = 0) {
        character.state = state;
        character.stateUntil = durationMs ? now() + durationMs : 0;
    }

    function getState() {
        if (
            character.state !== "idle" &&
            character.stateUntil &&
            now() > character.stateUntil
        ) {
            character.state = "idle";
            character.stateUntil = 0;
        }

        return character.state;
    }

    return {
        get signalUntil() {
            return character.signalUntil;
        },
        get distortionLevel() {
            return character.distortionLevel;
        },
        reset() {
            character.state = "idle";
            character.stateUntil = 0;
            character.signalUntil = 0;
        },
        setDistortion(level) {
            character.distortionLevel = level;
        },
        triggerVoiceSignal(state = "speaking") {
            character.signalUntil = now() + 760;
            setState(state, state === "success" ? 900 : 520);
        },
        triggerFail() {
            character.signalUntil = 0;
            setState("fail", 1100);
        },
        triggerCollisionFail() {
            character.signalUntil = 0;
            setState("broken", 900);
        },
        triggerRespawn() {
            setState("glitch", 650);
        },
        getRenderState() {
            return {
                state: getState(),
                distortion: character.distortionLevel,
                signalUntil: character.signalUntil,
            };
        },
    };
}
