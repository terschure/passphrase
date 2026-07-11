export const AUDIO_MIX_CONFIG = {
  musicVolume: 0.32,
  musicDuckedVolume: 0.08,
  sfxVolume: 0.4,
};

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
  const MUSIC_VOLUME = AUDIO_MIX_CONFIG.musicVolume;
  const MUSIC_DUCKED_VOLUME = AUDIO_MIX_CONFIG.musicDuckedVolume;
  const SFX_VOLUME = AUDIO_MIX_CONFIG.sfxVolume;
  const MUSIC_DEGRADATION_ENABLED = true;
  const DUCK_FADE_MS = 120;
  const DUCK_HOLD_MS = 400;
  const SFX_COOLDOWN_MS = 120;
  const lastSfxAt = new Map();
  let unlocked = false;
  let warningShown = false;
  const warnedAssets = new Set();
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
  let currentThemeKey = "";
  let degradationAmount = 0;
  let currentDistortionAmount = 0;
  let currentBitcrusherAmount = 0;
  let effectTransitionFrame = null;

  const mainTheme = new AudioCtor();
  mainTheme.loop = true;
  mainTheme.preload = "auto";
  mainTheme.volume = MUSIC_VOLUME;

  const themeSources = {
    level1: [
      ["main_sound_theme.ogg", "audio/ogg"],
      ["main_sound_theme.mp3", "audio/mpeg"],
    ],
    level2: [
      ["level_2_theme.ogg", "audio/ogg"],
      ["level_2_theme.mp3", "audio/mpeg"],
      ["main_sound_theme.ogg", "audio/ogg"],
      ["main_sound_theme.mp3", "audio/mpeg"],
    ],
    level3: [
      ["level_3_theme.ogg", "audio/ogg"],
      ["level_3_theme.mp3", "audio/mpeg"],
      ["level_2_theme.ogg", "audio/ogg"],
      ["level_2_theme.mp3", "audio/mpeg"],
      ["main_sound_theme.ogg", "audio/ogg"],
      ["main_sound_theme.mp3", "audio/mpeg"],
    ],
  };

  function resolveThemeKey(level) {
    if (Number(level) === 2) {
      return "level2";
    }

    if (Number(level) >= 3) {
      return "level3";
    }

    return "level1";
  }

  function setThemeSources(themeKey) {
    if (currentThemeKey === themeKey) {
      return false;
    }

    currentThemeKey = themeKey;
    mainTheme.replaceChildren();

    for (const [filename, type] of themeSources[themeKey] || themeSources.level1) {
      const source = documentRef.createElement("source");
      source.src = `${assetBaseUrl}/${filename}`;
      source.type = type;
      source.addEventListener?.("error", () => {
        warnAsset(`Theme asset failed to load: ${filename}`);
      });
      mainTheme.append(source);
    }

    mainTheme.load();
    return true;
  }

  setThemeSources("level1");

  const sfx = {
    levelFailed: createSfx(`${assetBaseUrl}/game_fx_level_failed.wav`, "levelFailed"),
    levelComplete: createSfx(`${assetBaseUrl}/game_fx_level_complete.wav`, "levelComplete"),
    respawn: createSfx(`${assetBaseUrl}/game_fx_respawn.wav`, "respawn"),
    wallPass: createSfx(`${assetBaseUrl}/game_fx_wall_pass.wav`, "wallPass"),
  };

  function createSfx(src, name) {
    const audio = new AudioCtor(src);
    audio.preload = "auto";
    audio.volume = SFX_VOLUME;
    audio.addEventListener?.("error", () => {
      warnAsset(`Sound effect failed to load: ${name} (${src})`);
    });
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

  function warnAsset(message) {
    if (warnedAssets.has(message)) {
      return;
    }

    warnedAssets.add(message);
    console.warn("[audio] " + message);
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

  // Called from an explicit user tap to prime the sound engine: it creates
  // and resumes the WebAudio context *inside* that gesture, so that later a
  // voice-triggered game start can still play music on iOS (which only lets
  // an AudioContext resume within a user gesture).
  function unlock() {
    unlockAudio();

    if (ensureMusicGraph() && musicContext) {
      musicContext.resume().catch(() => {});
    }
  }

  function makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const k = amount * 600;
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
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
    setThemeSources(resolveThemeKey(currentMusicLevel || 1));

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
      await Promise.all([mainThemePlayPromise, resumePromise].filter(Boolean));

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

  function setMusicLevel(level) {
    const nextLevel = Math.max(1, Number(level) || 1);
    currentMusicLevel = nextLevel;
    const themeChanged = setThemeSources(resolveThemeKey(nextLevel));

    if (themeChanged && unlocked) {
      mainTheme.currentTime = 0;
      startMainTheme();
    }
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
    param.linearRampToValueAtTime(
      targetValue,
      now + Math.max(0.01, timeMs / 1000),
    );
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
    const amount = MUSIC_DEGRADATION_ENABLED
      ? Math.min(1, Math.max(0, Number(requestedAmount) || 0))
      : 0;
    degradationAmount = amount;
    const distortionAmount = amount * 0.45;
    const bitcrusherAmount = amount * 0.55;
    const lowpassFrequency = 16000 - amount * 5200;
    const compensatedGain = Math.max(0.78, 1 - amount * 0.35);

    if (!unlocked) {
      console.log("[audio] music degradation queued", {
        source,
        amount: degradationAmount,
        distortionAmount,
        bitcrusherAmount,
        lowpassFrequency,
        compensatedGain,
      });
      return;
    }

    if (!ensureMusicGraph()) {
      return;
    }

    smoothSetEffectAmounts(distortionAmount, bitcrusherAmount, 900);
    smoothSetAudioParam(lowpassNode.frequency, lowpassFrequency, 900);
    smoothSetAudioParam(musicInputGain.gain, compensatedGain, 900);

    console.log("[audio] music degradation updated", {
      source,
      amount: degradationAmount,
      distortionAmount,
      bitcrusherAmount,
      bitcrusherBits: bitcrusherNode ? bitcrusherNode.bits : "clean",
      lowpassFrequency,
      compensatedGain,
    });
  }

  function updateMusicDegradation(level) {
    const maxDegradationLevel = 5;
    const degradationLevel = Math.max(1, Number(level) || 1);
    const amount = Math.min(
      Math.max((degradationLevel - 1) / (maxDegradationLevel - 1), 0),
      1,
    );
    applyMusicDegradationAmount(amount, "level");
  }

  function updateLevel2MusicDegradation(completedWords) {
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
        warnAsset("Sound effect " + name + " could not play.");
        if (error) {
          console.warn("[audio] Sound effect playback error:", error);
        }
      });
    } catch (error) {
      warnAsset("Sound effect " + name + " could not start.");
      if (error) {
        console.warn("[audio] Sound effect start error:", error);
      }
    }
  }

  return {
    preloadAll,
    unlock,
    startMainTheme,
    stopMainTheme,
    duckMusic,
    restoreMusic,
    fadeMusicVolume,
    setMusicLevel,
    updateMusicDegradation,
    updateLevel2MusicDegradation,
    setDistortionAmount,
    setBitcrusherAmount,
    playLevelFailedSound: () => playSfx("levelFailed"),
    playLevelCompleteSound: () => playSfx("levelComplete"),
    playRespawnSound: () => playSfx("respawn"),
    playWallPassSound: () => playSfx("wallPass"),
  };
}
