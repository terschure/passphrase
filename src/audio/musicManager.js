export const AUDIO_MIX_CONFIG = {
  musicVolume: 0.2,
  musicDuckedVolume: 0.05,
  sfxVolume: 0.26,
  musicEq: {
    enabled: true,
    type: "highshelf",
    frequencyHz: 3200,
    gainDb: -5,
    q: 0.7,
  },
};

export function createMusicManager({
  assetBaseUrl = "assets/audio",
  windowRef = window,
  documentRef = document,
  AudioCtor = Audio,
  performanceRef = performance,
  now = Date.now,
  onPlaybackBlocked = () => {},
} = {}) {
  const MUSIC_VOLUME = AUDIO_MIX_CONFIG.musicVolume;
  const MUSIC_DUCKED_VOLUME = AUDIO_MIX_CONFIG.musicDuckedVolume;
  const SFX_VOLUME = AUDIO_MIX_CONFIG.sfxVolume;
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
  let finalVictoryPlayback = null;
  let mainThemeGeneration = 0;
  let pendingEffectName = "";
  // null preserves the existing pre-game/iOS auto-start behavior, true means
  // playback was explicitly requested, and false is an intentional stop that
  // readiness events must not override.
  let musicPlaybackRequested = null;
  let currentMusicLevel = 0;
  let currentThemeKey = "";

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
  };

  function resolveThemeKey(level) {
    if (Number(level) >= 2) {
      return "level2";
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

  // A source replacement can leave an unlocked HTMLAudioElement paused on
  // iOS until its new media is ready. Retry at both useful readiness stages;
  // startMainTheme guards concurrent play attempts.
  function resumeThemeWhenReady() {
    if (unlocked && musicPlaybackRequested !== false && mainTheme.paused) {
      startMainTheme();
    }
  }

  mainTheme.addEventListener?.("loadeddata", resumeThemeWhenReady);
  mainTheme.addEventListener?.("canplay", resumeThemeWhenReady);

  const effectSources = {
    levelFailed: [["game_fx_level_failed.wav", "audio/wav"]],
    levelComplete: [
      ["game_fx_level_complete.ogg", "audio/ogg"],
      ["game_fx_level_complete.mp3", "audio/mpeg"],
      ["game_fx_level_complete.wav", "audio/wav"],
    ],
    finalVictory: [
      ["game_fx_final_victory_active_heroic.mp3", "audio/mpeg"],
    ],
    respawn: [["game_fx_respawn.wav", "audio/wav"]],
    wallPass: [["game_fx_wall_pass.wav", "audio/wav"]],
  };
  const effectPoolSizes = {
    levelFailed: 1,
    levelComplete: 1,
    finalVictory: 1,
    respawn: 1,
    wallPass: 3,
  };

  function createEffectPlayer(sources, name, index) {
    const audio = new AudioCtor();
    audio.preload = "auto";
    audio.volume = SFX_VOLUME;

    for (const [filename, type] of sources) {
      const source = documentRef.createElement("source");
      source.src = `${assetBaseUrl}/${filename}`;
      source.type = type;
      source.addEventListener?.("error", () => {
        warnAsset(
          `Sound effect failed to load: ${name}[${index}] (${filename})`,
        );
      });
      audio.append(source);
    }

    return {
      audio,
      generation: 0,
      lastStartedAt: 0,
      primed: false,
      priming: false,
    };
  }

  const effectPools = Object.fromEntries(
    Object.entries(effectSources).map(([name, sources]) => [
      name,
      Array.from({ length: effectPoolSizes[name] || 1 }, (_, index) =>
        createEffectPlayer(sources, name, index),
      ),
    ]),
  );

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

    for (const pool of Object.values(effectPools)) {
      for (const player of pool) {
        player.audio.load();
      }
    }
  }

  function unlockAudio() {
    unlocked = true;
  }

  function primeEffectPlayer(player) {
    if (player.primed || player.priming) {
      return;
    }

    const audio = player.audio;
    const generation = ++player.generation;
    player.priming = true;
    audio.muted = true;
    audio.volume = 0;

    let playResult;

    try {
      // This call must remain synchronous with the user's tap on iOS. Promise
      // handling may be asynchronous, but invoking play() may not be deferred.
      playResult = audio.play();
    } catch (error) {
      player.priming = false;
      audio.muted = false;
      audio.volume = SFX_VOLUME;
      return;
    }

    Promise.resolve(playResult).then(
      () => {
        player.primed = true;
        player.priming = false;

        if (player.generation === generation) {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = SFX_VOLUME;
        }
      },
      () => {
        player.priming = false;
        audio.muted = false;
        audio.volume = SFX_VOLUME;
      },
    );
  }

  function primeEffectPlayers() {
    for (const pool of Object.values(effectPools)) {
      for (const player of pool) {
        primeEffectPlayer(player);
      }
    }
  }

  // Prime a shared context inside the user gesture for generated talkback on
  // iOS. Music itself stays on the HTMLAudioElement and is not processed.
  function unlock() {
    unlockAudio();
    primeEffectPlayers();

    if (ensurePlaybackContext() && musicContext) {
      ensureMusicEqGraph();
      musicContext.resume().catch(() => {});
    }
  }

  function configureEqNode(node, settings) {
    node.type = settings.type;
    node.frequency.value = settings.frequencyHz;
    node.gain.value = settings.gainDb;
    node.Q.value = settings.q;
  }

  function ensurePlaybackContext() {
    if (musicContext) {
      return true;
    }

    const Context = windowRef.AudioContext || windowRef.webkitAudioContext;

    if (!Context) {
      return false;
    }

    try {
      musicContext = new Context();
      return true;
    } catch (error) {
      warn("Shared talkback audio context could not initialize.", error);
      return false;
    }
  }

  function ensureMusicEqGraph() {
    const settings = AUDIO_MIX_CONFIG.musicEq;

    if (!settings.enabled || musicSource) {
      return Boolean(musicSource) || !settings.enabled;
    }

    if (!ensurePlaybackContext()) {
      return false;
    }

    let source = null;

    try {
      const eqNode = musicContext.createBiquadFilter();
      configureEqNode(eqNode, settings);
      source = musicContext.createMediaElementSource(mainTheme);
      source.connect(eqNode).connect(musicContext.destination);
      musicSource = source;
      return true;
    } catch (error) {
      // If the media source was created before a later graph operation failed,
      // reconnect it directly so music cannot become silent.
      source?.connect?.(musicContext.destination);
      warn("Music EQ could not initialize; playing without EQ.", error);
      return false;
    }
  }

  async function startMainTheme() {
    musicPlaybackRequested = true;
    unlockAudio();
    const generation = mainThemeGeneration;
    setThemeSources(resolveThemeKey(currentMusicLevel || 1));

    const contextReady = ensurePlaybackContext();
    ensureMusicEqGraph();

    // iOS Safari only permits media playback and AudioContext.resume()
    // that are *initiated synchronously* inside the user gesture — before
    // any await. So start play() and resume() first, then await them.
    // (Awaiting resume() before calling play() silently drops the gesture
    // on iOS, so the music never starts even though desktop tolerates it.)
    if (mainTheme.paused && !mainThemePlayPromise) {
      let playResult;

      try {
        playResult = mainTheme.play();
      } catch (error) {
        playResult = Promise.reject(error);
      }

      const playPromise = Promise.resolve(playResult);
      mainThemePlayPromise = playPromise;
      const clearPlayPromise = () => {
        if (mainThemePlayPromise === playPromise) {
          mainThemePlayPromise = null;
        }
      };
      playPromise.then(() => {
        // A stale promise belongs to the same media element as any newer
        // request. Only pause it when playback is still intentionally stopped;
        // otherwise it may be the newly requested level theme now playing.
        if (generation !== mainThemeGeneration) {
          if (!musicPlaybackRequested) {
            mainTheme.pause();
          }
          return;
        }

        if (!musicPlaybackRequested) {
          mainTheme.pause();
        }
        clearPlayPromise();
      }, clearPlayPromise);
    }

    const resumePromise =
      contextReady && musicContext && musicContext.state !== "running"
        ? musicContext.resume()
        : null;

    try {
      await Promise.all([mainThemePlayPromise, resumePromise].filter(Boolean));
      if (pendingEffectName === "mainTheme") {
        clearPendingEffect();
      }
      return true;
    } catch (error) {
      markPlaybackBlocked("mainTheme", error);
      warn(
        "Main theme could not play. It may need a user click or a supported audio codec.",
        error,
      );
      return false;
    }
  }

  function stopMainTheme() {
    musicPlaybackRequested = false;
    mainThemeGeneration += 1;
    mainThemePlayPromise = null;

    if (restoreTimer) {
      clearTimeout(restoreTimer);
      restoreTimer = null;
    }

    if (musicFadeFrame) {
      windowRef.cancelAnimationFrame(musicFadeFrame);
      musicFadeFrame = null;
    }

    mainTheme.pause();
    mainTheme.currentTime = 0;
    mainTheme.volume = MUSIC_VOLUME;

    if (pendingEffectName === "mainTheme") {
      clearPendingEffect();
    }
  }

  function setMusicLevel(level) {
    const nextLevel = Math.max(1, Number(level) || 1);
    currentMusicLevel = nextLevel;
    const themeChanged = setThemeSources(resolveThemeKey(nextLevel));

    if (themeChanged && unlocked && musicPlaybackRequested !== false) {
      mainThemeGeneration += 1;
      // Do not let a pending play() for the previous source suppress the new
      // source's attempt. Its completion cannot clear a newer promise.
      mainThemePlayPromise = null;
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

  function selectEffectPlayer(name) {
    const pool = effectPools[name] || [];

    return (
      pool.find(
        (player) =>
          player.audio.paused || player.audio.ended || !player.lastStartedAt,
      ) ||
      pool.slice().sort((a, b) => a.lastStartedAt - b.lastStartedAt)[0] ||
      null
    );
  }

  function stopEffectPlayer(player) {
    if (!player) {
      return;
    }

    player.generation += 1;
    player.audio.pause?.();
    player.audio.currentTime = 0;
    player.audio.muted = false;
    player.audio.volume = SFX_VOLUME;
    player.lastStartedAt = 0;
  }

  function stopEffect(name) {
    for (const player of effectPools[name] || []) {
      stopEffectPlayer(player);
    }

    if (name === "finalVictory") {
      finalVictoryPlayback = null;
    }
  }

  function stopAllEffects() {
    for (const name of Object.keys(effectPools)) {
      stopEffect(name);
    }
  }

  function markPlaybackBlocked(name, error) {
    if (error?.name !== "NotAllowedError") {
      return;
    }

    pendingEffectName = name;
    onPlaybackBlocked(true, name);
  }

  function clearPendingEffect() {
    if (!pendingEffectName) {
      return;
    }

    pendingEffectName = "";
    onPlaybackBlocked(false, "");
  }

  function playEffect(name, { ignoreCooldown = false } = {}) {
    if (!unlocked) {
      pendingEffectName = name;
      onPlaybackBlocked(true, name);
      return Promise.resolve(false);
    }

    const player = selectEffectPlayer(name);

    if (!player) {
      return Promise.resolve(false);
    }

    const timestamp = now();
    const previous = lastSfxAt.get(name) || 0;

    if (!ignoreCooldown && timestamp - previous < SFX_COOLDOWN_MS) {
      return Promise.resolve(false);
    }

    lastSfxAt.set(name, timestamp);
    const audio = player.audio;
    const generation = ++player.generation;
    player.lastStartedAt = timestamp;
    player.primed = true;
    player.priming = false;
    audio.pause?.();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = SFX_VOLUME;

    if (name === "finalVictory") {
      finalVictoryPlayback = player;
    }

    let playResult;

    try {
      playResult = audio.play();
    } catch (error) {
      markPlaybackBlocked(name, error);
      if (error?.name !== "NotAllowedError") {
        warnAsset("Sound effect " + name + " could not start.");
        console.warn("[audio] Sound effect start error:", error);
      }
      return Promise.resolve(false);
    }

    if (name !== "levelComplete" && name !== "finalVictory") {
      const durationMs = Number.isFinite(audio.duration)
        ? audio.duration * 1000
        : DUCK_HOLD_MS;
      duckMusic(durationMs);
    }

    return Promise.resolve(playResult).then(
      () => {
        if (player.generation !== generation) {
          return false;
        }

        clearPendingEffect();
        return true;
      },
      (error) => {
        markPlaybackBlocked(name, error);
        if (error?.name !== "NotAllowedError") {
          warnAsset("Sound effect " + name + " could not play.");
          console.warn("[audio] Sound effect playback error:", error);
        }
        return false;
      },
    );
  }

  function stopFinalVictorySound() {
    stopEffect("finalVictory");
  }

  function stopTransitionAudio() {
    stopEffect("levelComplete");
    stopEffect("finalVictory");

    if (
      pendingEffectName === "levelComplete" ||
      pendingEffectName === "finalVictory"
    ) {
      clearPendingEffect();
    }
  }

  function playLevelCompleteTransition() {
    stopMainTheme();
    stopAllEffects();
    clearPendingEffect();
    return playEffect("levelComplete", { ignoreCooldown: true });
  }

  function playFinalVictoryTransition() {
    stopMainTheme();
    stopAllEffects();
    clearPendingEffect();
    return playEffect("finalVictory", { ignoreCooldown: true });
  }

  function retryPendingAudioFromGesture() {
    unlock();
    const name = pendingEffectName;

    if (!name) {
      clearPendingEffect();
      return Promise.resolve(false);
    }

    if (name === "mainTheme") {
      return startMainTheme();
    }

    return playEffect(name, { ignoreCooldown: true });
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
    playLevelCompleteTransition,
    playFinalVictoryTransition,
    stopTransitionAudio,
    retryPendingAudioFromGesture,
    ensureMusicPlaying: startMainTheme,
    getAudioContext: () => musicContext,
    playLevelFailedSound: () => playEffect("levelFailed"),
    playLevelCompleteSound: playLevelCompleteTransition,
    playFinalVictorySound: playFinalVictoryTransition,
    stopFinalVictorySound,
    playRespawnSound: () => playEffect("respawn"),
    playWallPassSound: () => playEffect("wallPass"),
  };
}
