export function createMusicManager({
    assetBaseUrl = "assets/audio",
    level2AudioDegradationStart = 0,
    level2AudioDegradationPerWord = 0.06,
    level2AudioDegradationMax = 1,
    windowRef = window,
    documentRef = document,
    AudioCtor = Audio,
    performanceRef = performance,
} = {}) {
    const MUSIC_VOLUME = 0.45;
    const MUSIC_DUCKED_VOLUME = 0.12;
    const SFX_VOLUME = 0.8;
    const DUCK_FADE_MS = 120;
    const DUCK_HOLD_MS = 400;
    const SFX_COOLDOWN_MS = 120;
    const lastSfxAt = new Map();
    let unlocked = false;
    let warningShown = false;
    let mainThemePlayPromise = null;
    let musicFadeFrame = null;
    let restoreTimer = null;
    let musicContext = null;
    let musicSource = null;
    let musicInputGain = null;
    let distortionNode = null;
    let bitcrusherNode = null;
    let lowpassNode = null;
    let musicEffectsReady = false;
    let currentMusicLevel = 0;
    let degradationAmount = 0;
    let currentDistortionAmount = 0;
    let currentBitcrusherAmount = 0;
    let effectTransitionFrame = null;

    const mainTheme = new AudioCtor();
    mainTheme.loop = true;
    mainTheme.preload = "auto";
    mainTheme.volume = MUSIC_VOLUME;

    const oggSource = documentRef.createElement("source");
    oggSource.src = `${assetBaseUrl}/main_sound_theme.ogg`;
    oggSource.type = "audio/ogg";
    const mp3Source = documentRef.createElement("source");
    mp3Source.src = `${assetBaseUrl}/main_sound_theme.mp3`;
    mp3Source.type = "audio/mpeg";
    mainTheme.append(oggSource, mp3Source);

    const sfx = {
        levelFailed: createSfx(`${assetBaseUrl}/game_fx_level_failed.wav`),
        respawn: createSfx(`${assetBaseUrl}/game_fx_respawn.wav`),
        wallPass: createSfx(`${assetBaseUrl}/game_fx_wall_pass.wav`),
    };

    function createSfx(src) {
        const audio = new AudioCtor(src);
        audio.preload = "auto";
        audio.volume = SFX_VOLUME;
        return audio;
    }

    function warn(message, error = null) {
        if (!warningShown) {
            console.warn("[audio] " + message, error || "");
            warningShown = true;
        } else if (error) {
            console.warn("[audio] " + message, error);
        }
    }

    function preloadAll() {
        mainTheme.load();

        for (const audio of Object.values(sfx)) {
            audio.load();
        }
    }

    function unlockAudio() {
        unlocked = true;
    }

    function makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const k = amount * 600;
        const deg = Math.PI / 180;

        for (let i = 0; i < samples; i += 1) {
            const x = (i * 2) / samples - 1;
            curve[i] =
                ((3 + k) * x * 20 * deg) /
                (Math.PI + k * Math.abs(x));
        }

        return curve;
    }

    function createBitcrusher(context) {
        const node = context.createScriptProcessor(2048, 1, 1);
        node.bits = 16;
        node.normfreq = 1;
        node.phaser = 0;
        node.last = 0;

        node.onaudioprocess = (event) => {
            const input = event.inputBuffer.getChannelData(0);
            const output = event.outputBuffer.getChannelData(0);
            const step = Math.pow(0.5, node.bits);

            for (let i = 0; i < input.length; i += 1) {
                node.phaser += node.normfreq;

                if (node.phaser >= 1) {
                    node.phaser -= 1;
                    node.last = step * Math.floor(input[i] / step + 0.5);
                }

                output[i] = node.last;
            }
        };

        return node;
    }

    function ensureMusicGraph() {
        if (musicEffectsReady) {
            return true;
        }

        const Context = windowRef.AudioContext || windowRef.webkitAudioContext;

        if (!Context) {
            warn("Web Audio is unavailable; music effects disabled.");
            return false;
        }

        try {
            musicContext = musicContext || new Context();
            console.log("[audio] music audio context started");

            musicSource =
                musicSource || musicContext.createMediaElementSource(mainTheme);
            musicInputGain = musicContext.createGain();
            distortionNode = musicContext.createWaveShaper();
            bitcrusherNode = createBitcrusher(musicContext);
            lowpassNode = musicContext.createBiquadFilter();

            lowpassNode.type = "lowpass";
            lowpassNode.frequency.value = 16000;
            lowpassNode.Q.value = 0.65;
            musicInputGain.gain.value = 1;
            distortionNode.curve = makeDistortionCurve(0);
            distortionNode.oversample = "2x";

            musicSource
                .connect(musicInputGain)
                .connect(distortionNode)
                .connect(bitcrusherNode)
                .connect(lowpassNode)
                .connect(musicContext.destination);

            musicEffectsReady = true;
            return true;
        } catch (error) {
            warn("Music effects could not initialize; playing clean theme.", error);
            return false;
        }
    }

    async function startMainTheme() {
        unlockAudio();

        const graphReady = ensureMusicGraph();

        // iOS Safari only permits media playback and AudioContext.resume()
        // that are *initiated synchronously* inside the user gesture — before
        // any await. So start play() and resume() first, then await them.
        // (Awaiting resume() before calling play() silently drops the gesture
        // on iOS, so the music never starts even though desktop tolerates it.)
        if (mainTheme.paused && !mainThemePlayPromise) {
            mainThemePlayPromise = mainTheme.play().finally(() => {
                mainThemePlayPromise = null;
            });
        }

        const resumePromise =
            graphReady && musicContext && musicContext.state !== "running"
                ? musicContext.resume()
                : null;

        try {
            await Promise.all(
                [mainThemePlayPromise, resumePromise].filter(Boolean),
            );

            if (graphReady && musicContext) {
                applyMusicDegradationAmount(degradationAmount, "resume");
            }
        } catch (error) {
            warn(
                "Main theme could not play. It may need a user click or a supported audio codec.",
                error,
            );
        }
    }

    function stopMainTheme() {
        if (restoreTimer) {
            clearTimeout(restoreTimer);
            restoreTimer = null;
        }

        if (musicFadeFrame) {
            windowRef.cancelAnimationFrame(musicFadeFrame);
            musicFadeFrame = null;
        }

        if (effectTransitionFrame) {
            windowRef.cancelAnimationFrame(effectTransitionFrame);
            effectTransitionFrame = null;
        }

        mainTheme.pause();
        mainTheme.currentTime = 0;
    }

    function fadeMusicVolume(targetVolume, durationMs) {
        if (musicFadeFrame) {
            windowRef.cancelAnimationFrame(musicFadeFrame);
            musicFadeFrame = null;
        }

        const fromVolume = mainTheme.volume;
        const startedAt = performanceRef.now();
        const duration = Math.max(1, durationMs);

        function step(timestamp) {
            const progress = Math.min(1, (timestamp - startedAt) / duration);
            mainTheme.volume = fromVolume + (targetVolume - fromVolume) * progress;

            if (progress < 1) {
                musicFadeFrame = windowRef.requestAnimationFrame(step);
            } else {
                musicFadeFrame = null;
            }
        }

        musicFadeFrame = windowRef.requestAnimationFrame(step);
    }

    function smoothSetAudioParam(param, targetValue, timeMs) {
        if (!musicContext || !param) {
            return;
        }

        const now = musicContext.currentTime;
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(targetValue, now + Math.max(0.01, timeMs / 1000));
    }

    function setDistortionAmount(amount) {
        if (!distortionNode) {
            return;
        }

        currentDistortionAmount = amount;
        distortionNode.curve = makeDistortionCurve(amount);
    }

    function setBitcrusherAmount(amount) {
        if (!bitcrusherNode) {
            return;
        }

        currentBitcrusherAmount = amount;
        bitcrusherNode.bits = Math.max(5, Math.round(16 - amount * 10));
        bitcrusherNode.normfreq = Math.max(0.16, 1 - amount * 0.82);
    }

    function smoothSetEffectAmounts(
        targetDistortionAmount,
        targetBitcrusherAmount,
        timeMs,
    ) {
        if (effectTransitionFrame) {
            windowRef.cancelAnimationFrame(effectTransitionFrame);
            effectTransitionFrame = null;
        }

        const fromDistortionAmount = currentDistortionAmount;
        const fromBitcrusherAmount = currentBitcrusherAmount;
        const startedAt = performanceRef.now();
        const duration = Math.max(1, timeMs);

        function step(timestamp) {
            const progress = Math.min(1, (timestamp - startedAt) / duration);
            const distortionAmount =
                fromDistortionAmount +
                (targetDistortionAmount - fromDistortionAmount) * progress;
            const bitcrusherAmount =
                fromBitcrusherAmount +
                (targetBitcrusherAmount - fromBitcrusherAmount) * progress;

            setDistortionAmount(distortionAmount);
            setBitcrusherAmount(bitcrusherAmount);

            if (progress < 1) {
                effectTransitionFrame = windowRef.requestAnimationFrame(step);
            } else {
                effectTransitionFrame = null;
            }
        }

        effectTransitionFrame = windowRef.requestAnimationFrame(step);
    }

    function applyMusicDegradationAmount(requestedAmount, source = "level") {
        const amount = Math.min(1, Math.max(0, Number(requestedAmount) || 0));
        degradationAmount = amount;
        const distortionAmount = amount;
        const bitcrusherAmount = amount;
        const lowpassFrequency = 16000 - amount * 11500;

        if (!unlocked) {
            console.log("[audio] music degradation queued", {
                source,
                amount: degradationAmount,
                distortionAmount,
                bitcrusherAmount,
                lowpassFrequency,
            });
            return;
        }

        if (!ensureMusicGraph()) {
            return;
        }

        smoothSetEffectAmounts(distortionAmount, bitcrusherAmount, 900);
        smoothSetAudioParam(lowpassNode.frequency, lowpassFrequency, 900);

        console.log("[audio] music degradation updated", {
            source,
            amount: degradationAmount,
            distortionAmount,
            bitcrusherAmount,
            bitcrusherBits: bitcrusherNode ? bitcrusherNode.bits : "clean",
            lowpassFrequency,
        });
    }

    function updateMusicDegradation(level) {
        currentMusicLevel = Math.max(1, Number(level) || 1);
        const maxDegradationLevel = 5;
        const amount = Math.min(
            Math.max((currentMusicLevel - 1) / (maxDegradationLevel - 1), 0),
            1,
        );
        applyMusicDegradationAmount(amount, "level");
    }

    function updateLevel2MusicDegradation(completedWords) {
        currentMusicLevel = 2;
        const amount = Math.min(
            level2AudioDegradationMax,
            level2AudioDegradationStart +
                Math.max(0, Number(completedWords) || 0) *
                    level2AudioDegradationPerWord,
        );
        applyMusicDegradationAmount(amount, "level-2-word");
    }

    function restoreMusic() {
        restoreTimer = null;
        fadeMusicVolume(MUSIC_VOLUME, DUCK_FADE_MS);
    }

    function duckMusic(durationMs = DUCK_HOLD_MS) {
        if (restoreTimer) {
            clearTimeout(restoreTimer);
        }

        fadeMusicVolume(MUSIC_DUCKED_VOLUME, DUCK_FADE_MS);
        restoreTimer = setTimeout(restoreMusic, Math.max(DUCK_HOLD_MS, durationMs));
    }

    function playSfx(name) {
        if (!unlocked) {
            return;
        }

        const audio = sfx[name];

        if (!audio) {
            return;
        }

        const now = Date.now();
        const previous = lastSfxAt.get(name) || 0;

        if (now - previous < SFX_COOLDOWN_MS) {
            return;
        }

        lastSfxAt.set(name, now);

        try {
            const instance = audio.cloneNode(true);
            instance.volume = SFX_VOLUME;
            const durationMs = Number.isFinite(audio.duration)
                ? audio.duration * 1000
                : DUCK_HOLD_MS;
            duckMusic(durationMs);
            instance.play().catch((error) => {
                warn("Sound effect " + name + " could not play.", error);
            });
        } catch (error) {
            warn("Sound effect " + name + " could not start.", error);
        }
    }

    return {
        preloadAll,
        startMainTheme,
        stopMainTheme,
        duckMusic,
        restoreMusic,
        fadeMusicVolume,
        updateMusicDegradation,
        updateLevel2MusicDegradation,
        setDistortionAmount,
        setBitcrusherAmount,
        playLevelFailedSound: () => playSfx("levelFailed"),
        playRespawnSound: () => playSfx("respawn"),
        playWallPassSound: () => playSfx("wallPass"),
    };
}
