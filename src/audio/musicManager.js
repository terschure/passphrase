export const AUDIO_MIX_CONFIG = {
  musicVolume: 0.32,
  musicDuckedVolume: 0.08,
  sfxVolume: 0.4,
};

export function createMusicManager({
  assetBaseUrl = "assets/audio",
  windowRef = window,
  documentRef = document,
  AudioCtor = Audio,
  performanceRef = performance,
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
    if (unlocked && mainTheme.paused) {
      startMainTheme();
    }
  }

  mainTheme.addEventListener?.("loadeddata", resumeThemeWhenReady);
  mainTheme.addEventListener?.("canplay", resumeThemeWhenReady);

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

  // Prime a shared context inside the user gesture for generated talkback on
  // iOS. Music itself stays on the HTMLAudioElement and is not processed.
  function unlock() {
    unlockAudio();

    if (ensurePlaybackContext() && musicContext) {
      musicContext.resume().catch(() => {});
    }
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

  async function startMainTheme() {
    unlockAudio();
    setThemeSources(resolveThemeKey(currentMusicLevel || 1));

    const contextReady = ensurePlaybackContext();

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
      playPromise.then(clearPlayPromise, clearPlayPromise);
    }

    const resumePromise =
      contextReady && musicContext && musicContext.state !== "running"
        ? musicContext.resume()
        : null;

    try {
      await Promise.all([mainThemePlayPromise, resumePromise].filter(Boolean));
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

    mainTheme.pause();
    mainTheme.currentTime = 0;
  }

  function setMusicLevel(level) {
    const nextLevel = Math.max(1, Number(level) || 1);
    currentMusicLevel = nextLevel;
    const themeChanged = setThemeSources(resolveThemeKey(nextLevel));

    if (themeChanged && unlocked) {
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
    ensureMusicPlaying: startMainTheme,
    getAudioContext: () => musicContext,
    playLevelFailedSound: () => playSfx("levelFailed"),
    playLevelCompleteSound: () => playSfx("levelComplete"),
    playRespawnSound: () => playSfx("respawn"),
    playWallPassSound: () => playSfx("wallPass"),
  };
}
