import { createMusicManager } from "../audio/musicManager.js";
import { bindActionEvents } from "./actionBindings.js";
import { bindControlEvents } from "./controlBindings.js";
import { createLevelCatalog } from "../content/levelCatalog.js";
import { parseGameScript } from "../content/targetPlan.js";
import {
    ENVIRONMENT_BODY_CLASSES,
    resolveEnvironment,
} from "../content/environments.js";
import {
    clearScriptOverride,
    fetchFileScript,
    saveScriptOverride,
} from "../content/gameScriptSource.js";
import {
    ECHO_RUNTIME_CONFIG,
    getPreferredEchoMimeType,
} from "../echo/defaultConfig.js";
import { createEchoRuntime } from "../echo/runtime.js";
import {
    updateAsciiWaveformBackground as updateAsciiWaveformBackgroundView,
    updateGameOverFire as updateGameOverFireView,
    updateGameOverWaveform as updateGameOverWaveformView,
} from "../effects/asciiWaveform.js";
import { createMicrophoneVisualizer } from "../effects/microphoneVisualizer.js";
import { createMemoryPhraseEnemySystem } from "../effects/memoryPhraseEnemies.js";
import { consumeCatchText } from "../game/catchMode.js";
import {
    createLevelActivationState,
    getKeygenDistortionForLevel,
    getNextLevel,
} from "../game/levelProgression.js";
import { createLevelProgressionEffects } from "../game/levelProgressionEffects.js";
import {
    acceptContinuePhrase as acceptContinuePhraseRule,
    clearWordGameOverCounts,
    createInitialGameState,
    getCaughtBeatDeadline,
    handleBeatDeadline as handleBeatDeadlineRule,
    markCurrentWordCaught as markCurrentWordCaughtRule,
    recordWordGameOver,
    recordCompletedPhrase as recordCompletedPhraseRule,
    resetSequence as resetSequenceRule,
    shouldAutoPassWord,
} from "../game/rules.js";
import { consumeSequenceText } from "../game/sequenceText.js";
import { createVocalizationDetector } from "../game/vocalization.js";
import {
    escapeRegExp as escapeRegExpText,
    findTargetEnd as findTargetEndInText,
    textMatchesTarget as textMatchesTargetText,
} from "../matching/matching.js";
import {
    getRoadMetricsFromViewport,
    obstacleIntersectsPlayer,
} from "../renderers/ascii/hash.js";
import {
    createUnicodeLines,
    getPlayerBounds as getPlayerBoundsFromMetrics,
    KEYGEN_HIT_COOLDOWN_MS,
} from "../renderers/ascii/player.js";
import { createKeygenCharacter } from "../renderers/ascii/keygenCharacter.js";
import { createRoadAnimation } from "../renderers/ascii/roadAnimation.js";
import { renderRoadScene } from "../renderers/ascii/roadRenderer.js";
import {
    createScaryFireFrames,
    GATE_ANIM_MS,
    WALL_FIRE_FRAMES,
    WALL_HEIGHT,
} from "../renderers/ascii/roadScene.js";
import { createTimelineRenderState } from "../renderers/ascii/timelineState.js";
import { createSpeechService } from "../speech/speechService.js";
import {
    createRecognitionResultHandler,
    createSpeechServiceCallbacks,
} from "../speech/recognitionFlow.js";
import { createTranscriptState } from "../speech/transcriptState.js";
import { TALKBACK_RUNTIME_CONFIG } from "../talkback/defaultConfig.js";
import { createTalkbackRuntime } from "../talkback/runtime.js";
import { createDomRefs, readConfig } from "../ui/domRefs.js";
import { renderGameOverScreen as renderGameOverScreenView } from "../ui/gameOver.js";
import {
    renderLevelStatus as renderLevelStatusView,
    renderLivesDisplay as renderLivesDisplayView,
    renderScoreDisplay as renderScoreDisplayView,
    renderSequenceStatusText,
} from "../ui/hud.js";
import { createLevelIntroController } from "../ui/levelIntro.js";
import {
    hideOnboarding as hideOnboardingView,
    isStartCommand as isStartCommandText,
    normalizeVoiceCommand as normalizeVoiceCommandText,
} from "../ui/onboarding.js";
import {
    closeSettings as closeSettingsView,
    openSettings as openSettingsView,
} from "../ui/settingsPanel.js";
import {
    renderTranscript as renderTranscriptView,
    renderTranscriptInto as renderTranscriptIntoView,
} from "../ui/transcript.js";
import { renderWordList as renderWordListView } from "../ui/wordList.js";

export function initPassphraseApp() {
            const SpeechRecognition =
                window.SpeechRecognition || window.webkitSpeechRecognition;
            const refs = createDomRefs(document);
            const {
                startButton,
                onboardingScreen,
                onboardingCard,
                onboardingTitle,
                onboardingCopy,
                onboardingAction,
                aboutTitleButton,
                aboutScreen,
                aboutCloseButton,
                aboutBackButton,
                levelCompleteScreen,
                levelCompleteTitle,
                levelCompleteCopy,
                levelCompleteNext,
                heroIntroScreen,
                finalVictoryScreen,
                finalVictoryUnicode,
                finalVictoryLineOne,
                finalVictoryLineTwo,
                finalVictoryPlayAgain,
                unicodeFeedback,
                onboardingSpectrum,
                micInitScreen,
                micInitAction,
                audioResumeScreen,
                audioResumeAction,
                stopButton,
                clearButton,
                openSettingsButton,
                closeSettingsButton,
                settingsBackdrop,
                settingsPanel,
                resetSequenceButton,
                modeInput,
                secondsInput,
                livesInput,
                retriesInput,
                transcriptSourceInput,
                sentenceFuzzyMatchInput,
                continuePhraseInput,
                echoModeInput,
                gameOverScreen,
                gameOverTitle,
                gameOverFire,
                gameOverRound,
                gameOverCopy,
                gameOverPhrase,
                gameOverTranscript,
                echoPanel,
                echoHeader,
                echoRows,
                talkbackEnabledInput,
                talkbackEndpointInput,
                talkbackThresholdInput,
                talkbackEndpointStatus,
                talkbackReferenceStatus,
                talkbackVoiceStatus,
                talkbackLastStatus,
                wordsInput,
                wordList,
                sequenceStatus,
                timelineState,
                currentLevelTitle,
                currentSequenceTitle,
                timerDisplay,
                livesDisplay,
                scoreDisplay,
                timeline,
                levelIntro,
                levelIntroTitle,
                levelIntroSubtitle,
                memoryPhraseLayer,
                devLevelButtons,
                status,
                finalText,
                interimText,
                asciiWaveformBackground,
                gameOverVisualizer,
            } = refs;
            const transcriptState = createTranscriptState();
            const caughtWords = new Set();
            const DEV_MODE = true;
            const LEVEL_INTRO_DURATION_MS = 1800;
            const LEVEL_3_WARNING_DURATION_MS = 2200;
            const LEVEL_COMPLETE_DURATION_MS = 1900;
            const HERO_INTRO_DURATION_MS = 3600;
            const HERO_INTRO_TEXT_SWITCH_MS = 220;
            const FINAL_VICTORY_FIRST_LINE_MS = 1700;
            const VOCAL_THRESHOLD = 0.18;
            const VOCAL_MIN_MS = 350;
            const vocalizationDetector = createVocalizationDetector({
                threshold: VOCAL_THRESHOLD,
                minMs: VOCAL_MIN_MS,
            });
            const levelCatalog = createLevelCatalog({
                getScriptLevels: () =>
                    parseGameScript(readConfig(refs).wordPlan).levels,
            });
            let currentLevel = 1;
            let currentWordIndex = 0;
            let totalWordsPerLevel = 0;
            const completedPhrasesFromLevel1 = [];
            let levelTransitionActive = false;
            let sequenceFailed = false;
            let failReason = "timeout";
            let deadline = null;
            let wordStartedAt = 0;
            let timerInterval = null;
            let livesLeft = 3;
            let retriesLeft = 2;
            let wordCaughtThisBeat = false;
            let gateOpenedAt = 0;
            let refillAnimationUntil = 0;
            let gameOverContinuing = false;
            let gameOverContinueTimer = null;
            let gameOverRecorded = false;
            const gameOverCountsByWord = new Map();
            let levelCompleteTimer = null;
            let heroIntroTimer = null;
            let finalVictoryTimer = null;
            let pendingLevelAfterComplete = null;
            let levelCompleteSoundPlayed = false;
            let level3WarningShown = false;
            let unicodeFeedbackTimer = null;
            let wallEchoFiredThisBeat = false;
            let gameStarted = false;
            let activeRecognition = null;
            const recognitionState = {
                starting: false,
                listening: false,
            };
            let onboardingVoiceBlocked = false;
            let onboardingRestartTimer = null;
            let recognitionStartedAt = 0;
            let onboardingRestartDelay = 500;
            let lastGameOverFireFrame = -1;
            let lastKeygenHitAt = 0;
            const firedTalkbackCues = new Set();
            const prefetchedTalkbackCues = new Set();
            const keygenCharacter = createKeygenCharacter();
            const SUCCESS_COMMENTS = [
                "ok!",
                "I passed!",
                "through!",
                "nice!",
                "again!",
            ];
            const FAIL_COMMENTS = [
                "oops",
                "blocked",
                "try again",
                "not yet",
                "ouch",
            ];

            const AudioManager = createMusicManager({
                assetBaseUrl: "assets/audio",
                onPlaybackBlocked(blocked) {
                    audioResumeScreen?.classList.toggle("visible", blocked);
                    audioResumeScreen?.setAttribute(
                        "aria-hidden",
                        blocked ? "false" : "true",
                    );

                    if (blocked) {
                        audioResumeAction?.focus();
                    }
                },
            });

            const startMainTheme = AudioManager.startMainTheme;
            const playLevelFailedSound = AudioManager.playLevelFailedSound;
            const playRespawnSound = AudioManager.playRespawnSound;
            const playWallPassSound = AudioManager.playWallPassSound;
            const playLevelCompleteTransition =
                AudioManager.playLevelCompleteTransition;
            const playFinalVictoryTransition =
                AudioManager.playFinalVictoryTransition;
            const stopTransitionAudio = AudioManager.stopTransitionAudio;
            const levelProgressionEffects = createLevelProgressionEffects({
                getCurrentLevel: () => currentLevel,
                syncLevel2EnemyCount() {
                    memoryPhraseSystem.syncEnemyCount();
                },
                updateKeygenDistortion,
            });
            const memoryPhraseSystem = createMemoryPhraseEnemySystem({
                layer: memoryPhraseLayer,
                getCurrentLevel: () => currentLevel,
                getCompletedWordCount: () =>
                    levelProgressionEffects.getLevel2CompletedWordCount(),
                getPhraseSource: () => completedPhrasesFromLevel1,
            });
            const microphoneVisualizer = createMicrophoneVisualizer({
                onAmplitude(amplitude, timestamp) {
                    updateAsciiWaveformBackground(amplitude, timestamp);
                    updateGameOverWaveform(amplitude, timestamp);
                    detectSoundPhrase(amplitude, timestamp);
                },
                onIdleFrame(timestamp) {
                    updateAsciiWaveformBackground(0.1, timestamp);
                    updateGameOverWaveform(0.26, timestamp);
                },
                onSpectrum(frequencies) {
                    renderOnboardingSpectrum(frequencies);
                },
            });
            const roadAnimation = createRoadAnimation({
                render: renderSequenceStatus,
            });
            const levelIntroController = createLevelIntroController({
                levelIntro,
                levelIntroTitle,
                levelIntroSubtitle,
                introDurationMs: LEVEL_INTRO_DURATION_MS,
                onRender: renderSequenceStatus,
                onComplete: beginActiveLevelGameplay,
            });

            function getAudioContext() {
                return microphoneVisualizer.audioContext;
            }

            function getMicStream() {
                return microphoneVisualizer.micStream;
            }

            function getRoadMetrics() {
                const styles = getComputedStyle(timeline);
                const fontSize = parseFloat(styles.fontSize) || 14;
                const lineHeight =
                    parseFloat(styles.lineHeight) || fontSize * 1.08;
                const letterSpacing = parseFloat(styles.letterSpacing) || 0;
                const measurer =
                    getRoadMetrics.measurer ||
                    (getRoadMetrics.measurer =
                        document.createElement("canvas"));
                const context = measurer.getContext("2d");
                context.font = `${styles.fontWeight} ${fontSize}px ${styles.fontFamily}`;
                const charWidth =
                    context.measureText("M").width + letterSpacing;
                return getRoadMetricsFromViewport({
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                    charWidth,
                    lineHeight,
                });
            }

            function openSettings() {
                openSettingsView(refs);
            }

            function closeSettings() {
                closeSettingsView(refs);
            }

            function renderOnboardingSpectrum(frequencies) {
                if (
                    !onboardingSpectrum ||
                    onboardingScreen.classList.contains("hidden")
                ) {
                    return;
                }

                const ctx = onboardingSpectrum.getContext("2d");
                if (!ctx) {
                    return;
                }

                const width = onboardingSpectrum.width;
                const height = onboardingSpectrum.height;
                const bars = 28;
                const bucket = Math.max(
                    1,
                    Math.floor(frequencies.length / bars),
                );
                const gap = 2;
                const barWidth = (width - gap * (bars - 1)) / bars;

                ctx.clearRect(0, 0, width, height);
                const gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, "#ff70d5");
                gradient.addColorStop(0.2, "#73e6ff");
                gradient.addColorStop(0.4, "#fff59a");
                gradient.addColorStop(0.6, "#a78bfa");
                gradient.addColorStop(0.8, "#7cffd4");
                gradient.addColorStop(1, "#ff8ad8");
                ctx.fillStyle = gradient;

                for (let i = 0; i < bars; i += 1) {
                    let sum = 0;
                    for (let j = 0; j < bucket; j += 1) {
                        sum += frequencies[i * bucket + j] || 0;
                    }
                    const level = sum / bucket / 255;
                    const barHeight = Math.max(2, level * height);
                    ctx.fillRect(
                        i * (barWidth + gap),
                        height - barHeight,
                        barWidth,
                        barHeight,
                    );
                }
            }

            // Single opening modal: start the mic (for the live spectrum) and
            // voice recognition (so saying "start" begins the game) right away.
            async function startOnboarding() {
                const resumeAudio = () => {
                    getAudioContext()?.resume?.().catch(() => {});
                    document.removeEventListener("pointerdown", resumeAudio);
                    document.removeEventListener("keydown", resumeAudio);
                };
                document.addEventListener("pointerdown", resumeAudio);
                document.addEventListener("keydown", resumeAudio);

                // Open the mic first so permission is resolved before speech
                // recognition starts — starting them in a race made recognition
                // begin before it had mic access and immediately end.
                try {
                    await startVisualizer();
                } catch (error) {
                    /* mic blocked — the button still starts the game */
                }

                startOnboardingVoiceRecognition();
            }

            // Restart onboarding recognition with backoff. A recognizer that
            // ends almost immediately (no mic, network error, etc.) must not
            // hot-loop; each quick failure widens the delay, a healthy session
            // resets it.
            function scheduleOnboardingRecognitionRestart() {
                if (
                    onboardingRestartTimer ||
                    gameStarted ||
                    onboardingVoiceBlocked
                ) {
                    return;
                }

                const ranMs = Date.now() - recognitionStartedAt;
                onboardingRestartDelay =
                    ranMs < 1500
                        ? Math.min(onboardingRestartDelay * 2, 10000)
                        : 500;

                onboardingRestartTimer = setTimeout(() => {
                    onboardingRestartTimer = null;
                    startOnboardingVoiceRecognition();
                }, onboardingRestartDelay);
            }

            function hideOnboarding() {
                hideOnboardingView(refs);
            }

            function hideMicInit() {
                if (!micInitScreen) {
                    return;
                }

                micInitScreen.classList.add("hidden");
                micInitScreen.setAttribute("aria-hidden", "true");
            }

            function openAboutModal() {
                if (!aboutScreen) {
                    return;
                }

                aboutScreen.classList.add("visible");
                aboutScreen.setAttribute("aria-hidden", "false");
                aboutScreen.scrollTop = 0;
                const aboutPanel = aboutScreen.querySelector(
                    ".modal-panel--about",
                );
                if (aboutPanel) {
                    aboutPanel.scrollTop = 0;
                }
                aboutBackButton?.focus();
            }

            function closeAboutModal() {
                if (!aboutScreen) {
                    return;
                }

                aboutScreen.classList.remove("visible");
                aboutScreen.setAttribute("aria-hidden", "true");
                aboutTitleButton?.focus();
            }

            function clearLevelCompleteTimer() {
                if (levelCompleteTimer) {
                    clearTimeout(levelCompleteTimer);
                    levelCompleteTimer = null;
                }
                pendingLevelAfterComplete = null;
            }

            function hideLevelCompleteModal() {
                levelCompleteScreen?.classList.remove("visible");
                levelCompleteScreen?.setAttribute("aria-hidden", "true");
            }

            function clearHeroIntroTimer() {
                if (heroIntroTimer) {
                    clearTimeout(heroIntroTimer);
                    heroIntroTimer = null;
                }
            }

            function clearFinalVictoryTimer() {
                if (finalVictoryTimer) {
                    clearTimeout(finalVictoryTimer);
                    finalVictoryTimer = null;
                }
            }

            function hideHeroIntro() {
                clearHeroIntroTimer();
                heroIntroScreen?.classList.remove(
                    "visible",
                    "hero-intro--text-switching",
                );
                heroIntroScreen?.setAttribute("aria-hidden", "true");
            }

            function hideFinalVictoryScreen() {
                clearFinalVictoryTimer();
                stopTransitionAudio?.();
                finalVictoryScreen?.classList.remove("visible");
                finalVictoryScreen?.setAttribute("aria-hidden", "true");
                finalVictoryLineOne?.classList.remove("visible");
                finalVictoryLineTwo?.classList.remove("visible");
                finalVictoryPlayAgain?.classList.remove("visible");
            }

            function showUnicodeFeedback(kind) {
                if (!unicodeFeedback) {
                    return;
                }

                const metrics = getRoadMetrics();
                const bounds = getPlayerBounds(metrics);
                const styles = getComputedStyle(timeline);
                const fontSize = parseFloat(styles.fontSize) || 14;
                const lineHeight =
                    parseFloat(styles.lineHeight) || fontSize * 1.08;
                const letterSpacing = parseFloat(styles.letterSpacing) || 0;
                const measurer =
                    showUnicodeFeedback.measurer ||
                    (showUnicodeFeedback.measurer =
                        document.createElement("canvas"));
                const context = measurer.getContext("2d");
                context.font = `${styles.fontWeight} ${fontSize}px ${styles.fontFamily}`;
                const charWidth =
                    context.measureText("M").width + letterSpacing;
                const timelineRect = timeline.getBoundingClientRect();
                const mouthCol = bounds.left + 5;
                const mouthRow = bounds.top + 4;
                unicodeFeedback.style.left = `${Math.max(
                    8,
                    timelineRect.left + mouthCol * charWidth - 8,
                )}px`;
                unicodeFeedback.style.top = `${Math.max(
                    44,
                    timelineRect.top + mouthRow * lineHeight,
                )}px`;
                const comments = kind === "fail" ? FAIL_COMMENTS : SUCCESS_COMMENTS;
                const index = Math.floor(Math.random() * comments.length);
                unicodeFeedback.textContent = comments[index];
                unicodeFeedback.classList.remove("visible", "fail", "success");
                void unicodeFeedback.offsetWidth;
                unicodeFeedback.classList.add("visible", kind === "fail" ? "fail" : "success");
                unicodeFeedback.setAttribute("aria-hidden", "false");

                if (unicodeFeedbackTimer) {
                    clearTimeout(unicodeFeedbackTimer);
                }

                unicodeFeedbackTimer = setTimeout(() => {
                    unicodeFeedback.classList.remove("visible", "fail", "success");
                    unicodeFeedback.setAttribute("aria-hidden", "true");
                    unicodeFeedbackTimer = null;
                }, 920);
            }

            // Runs inside the "initialize microphone" tap. That gesture is the
            // one chance to unlock the sound engine (resume the WebAudio
            // context) so that afterwards the game can be started by voice and
            // still play music/effects on iOS. It also turns the microphone
            // permission prompt into a response to an explicit action rather
            // than an unexpected pop-up on page load.
            function initializeMicAndAudio() {
                AudioManager.unlock();
                microphoneVisualizer.unlockAudio();
                hideMicInit();
                startOnboarding();
                onboardingAction.focus();
            }

            function startRoadAnimation() {
                roadAnimation.start();
            }

            function stopRoadAnimation() {
                roadAnimation.stop();
            }

            function restartSequenceIfListening() {
                if (stopButton.disabled) {
                    return;
                }

                startRoadAnimation();

                if (
                    isSequenceMode() &&
                    getTargetWords().length &&
                    !deadline &&
                    !sequenceFailed &&
                    !levelTransitionActive
                ) {
                    startSequenceTimer();
                }
            }

            function escapeRegExp(text) {
                return escapeRegExpText(text);
            }

            function getLevels() {
                return levelCatalog.getLevels();
            }

            function getLevelConfig(levelId = currentLevel) {
                return levelCatalog.getLevelConfig(levelId);
            }

            function getLevelEntries(levelId = currentLevel) {
                return levelCatalog.getLevelEntries(levelId);
            }

            function getTargetEntries() {
                return getLevelEntries(currentLevel);
            }

            function getTargetWords() {
                return getTargetEntries().map((entry) => entry.text);
            }

            function getCurrentTargetEntry(words = getTargetEntries()) {
                if (!words.length) {
                    return null;
                }

                return words[Math.min(currentWordIndex, words.length - 1)];
            }

            function createRuleStateSnapshot() {
                const state = createInitialGameState({
                    currentLevel,
                    currentWordIndex,
                    lives: livesLeft,
                    retries: retriesLeft,
                    caughtWords,
                    completedPhrasesFromLevel1,
                });
                state.sequenceFailed = sequenceFailed;
                state.failReason = failReason;
                state.wordCaughtThisBeat = wordCaughtThisBeat;
                return state;
            }

            function applyRuleState(state) {
                currentWordIndex = state.currentWordIndex;
                sequenceFailed = state.sequenceFailed;
                failReason = state.failReason;
                livesLeft = state.livesLeft;
                retriesLeft = state.retriesLeft;
                wordCaughtThisBeat = state.wordCaughtThisBeat;
                caughtWords.clear();
                for (const word of state.caughtWords) {
                    caughtWords.add(word);
                }
                completedPhrasesFromLevel1.length = 0;
                completedPhrasesFromLevel1.push(
                    ...state.completedPhrasesFromLevel1,
                );
            }

            function renderLevelStatus(entries = getTargetEntries()) {
                renderLevelStatusView({
                    refs,
                    entries,
                    currentWordIndex,
                    currentEntry: getCurrentTargetEntry(entries),
                });
            }

            function recordCompletedPhrase(phrase) {
                const state = createRuleStateSnapshot();
                recordCompletedPhraseRule(state, phrase);
                completedPhrasesFromLevel1.length = 0;
                completedPhrasesFromLevel1.push(
                    ...state.completedPhrasesFromLevel1,
                );
            }

            function applyLevelEnvironment(level, useMockMemories = false) {
                const preset = resolveEnvironment(level.environment);
                document.body.classList.remove(...ENVIRONMENT_BODY_CLASSES);
                document.body.classList.add(preset.bodyClass);

                if (preset.memoryEnemies) {
                    startMemoryPhraseSystem(useMockMemories);
                } else {
                    stopMemoryPhraseSystem();
                }
            }

            function setActiveLevel(
                levelId,
                {
                    showIntro = true,
                    useMockMemories = false,
                    preserveHeroIntro = false,
                } = {},
            ) {
                if (!preserveHeroIntro) {
                    hideHeroIntro();
                }
                hideFinalVictoryScreen();
                clearLevelCompleteTimer();
                hideLevelCompleteModal();
                levelCompleteSoundPlayed = false;
                clearWordGameOverCounts(gameOverCountsByWord);
                gameOverRecorded = false;
                const level = getLevelConfig(levelId);
                const activationState = createLevelActivationState({
                    level,
                    entryCount: getLevelEntries(level.id).length,
                    showIntro,
                    livesLimit: getLivesLimit(),
                    retriesLimit: getRetriesLimit(),
                });
                currentLevel = activationState.currentLevel;
                currentWordIndex = activationState.currentWordIndex;
                totalWordsPerLevel = activationState.totalWordsPerLevel;
                levelTransitionActive = activationState.levelTransitionActive;
                sequenceFailed = activationState.sequenceFailed;
                failReason = activationState.failReason;
                deadline = activationState.deadline;
                wordStartedAt = 0;
                wordCaughtThisBeat = activationState.wordCaughtThisBeat;
                gateOpenedAt = activationState.gateOpenedAt;
                wallEchoFiredThisBeat = activationState.wallEchoFiredThisBeat;
                livesLeft = activationState.livesLeft;
                retriesLeft = activationState.retriesLeft;
                refillAnimationUntil = activationState.refillAnimationUntil;
                level3WarningShown = false;
                caughtWords.clear();
                firedTalkbackCues.clear();
                prefetchedTalkbackCues.clear();
                vocalizationDetector.reset();
                lastKeygenHitAt = activationState.lastKeygenHitAt;
                keygenCharacter.reset();
                levelProgressionEffects.reset(level.id);
                stopSequenceTimer();
                clearTranscript();
                applyLevelEnvironment(level, useMockMemories);
                AudioManager.setMusicLevel?.(level.id);
                renderGameOverScreen();
                renderWordList();
                renderSequenceStatus();

                if (showIntro) {
                    showLevelIntro(level);
                } else {
                    beginActiveLevelGameplay();
                }
            }

            function showLevelIntro(level = getLevelConfig()) {
                levelTransitionActive = true;
                deadline = null;
                stopSequenceTimer();
                levelIntroController.show(level, {
                    cards: getLevelIntroCards(level),
                    stableBackdrop: true,
                });
            }

            function showHeroIntroBeforeLevel(levelId, useMockMemories) {
                hideFinalVictoryScreen();
                clearHeroIntroTimer();
                levelTransitionActive = true;
                deadline = null;
                stopSequenceTimer();
                heroIntroScreen?.classList.remove("hero-intro--text-switching");
                heroIntroScreen?.classList.add("visible");
                heroIntroScreen?.setAttribute("aria-hidden", "false");
                renderSequenceStatus();

                heroIntroTimer = setTimeout(() => {
                    heroIntroScreen?.classList.add("hero-intro--text-switching");
                    heroIntroTimer = setTimeout(() => {
                        heroIntroTimer = null;
                        levelIntro?.classList.add("level-intro--handoff");
                        setActiveLevel(levelId, {
                            showIntro: true,
                            useMockMemories,
                            preserveHeroIntro: true,
                        });
                        hideHeroIntro();
                        setTimeout(() => {
                            levelIntro?.classList.remove("level-intro--handoff");
                        }, 80);
                    }, HERO_INTRO_TEXT_SWITCH_MS);
                }, Math.max(1, HERO_INTRO_DURATION_MS - HERO_INTRO_TEXT_SWITCH_MS));
            }

            function getLevelIntroCards(level) {
                const titleCard = {
                    title: level.name.toUpperCase(),
                    subtitle: "",
                    message: false,
                    durationMs: 1900,
                };

                if (level.id === 3) {
                    return [
                        titleCard,
                        {
                            title: "YOUR VOICE HAS BEEN STOLEN",
                            subtitle: "",
                            message: true,
                            durationMs: 3100,
                        },
                        {
                            title: "Reach the end to claim it back.",
                            subtitle: "",
                            message: true,
                            durationMs: 3100,
                        },
                    ];
                }

                return [
                    titleCard,
                    {
                        title: level.subtitle || "",
                        subtitle: "",
                        message: true,
                        durationMs: 3200,
                    },
                ];
            }

            function beginActiveLevelGameplay() {
                levelTransitionActive = false;
                level3WarningShown = currentLevel === 3;
                renderSequenceStatus();

                // Source changes during level transitions can pause media on
                // iOS Safari. Reassert both element and AudioContext playback
                // when the intro has finished.
                AudioManager.ensureMusicPlaying?.();

                if (gameStarted) {
                    startRoadAnimation();
                }

                if (
                    gameStarted &&
                    isSequenceMode() &&
                    getTargetWords().length &&
                    !sequenceFailed
                ) {
                    startSequenceTimer();
                }

                fireDueTalkbackCues();
            }

            function transitionToNextLevel() {
                const nextLevel = getNextLevel(getLevels(), currentLevel);

                if (!nextLevel) {
                    return false;
                }

                setActiveLevel(nextLevel.id, { showIntro: true });
                return true;
            }

            function showLevelCompleteModal({ final = false, nextLevel = null } = {}) {
                clearLevelCompleteTimer();
                levelTransitionActive = true;
                deadline = null;
                stopSequenceTimer();
                stopRoadAnimation();
                pendingLevelAfterComplete = nextLevel;

                if (levelCompleteTitle) {
                    levelCompleteTitle.textContent = final
                        ? "VOICE RECLAIMED"
                        : "LEVEL COMPLETE";
                }
                if (levelCompleteCopy) {
                    levelCompleteCopy.textContent = final
                        ? "You beat the system."
                        : currentLevel === 1
                          ? "Unicode passed through."
                          : "Unicode passed through.";
                }
                if (levelCompleteNext) {
                    levelCompleteNext.textContent = final
                        ? "Your voice is yours again."
                        : "Moving to the next level.";
                }

                levelCompleteScreen?.classList.add("visible");
                levelCompleteScreen?.setAttribute("aria-hidden", "false");
                if (!levelCompleteSoundPlayed) {
                    playLevelCompleteTransition?.();
                    levelCompleteSoundPlayed = true;
                }
                renderSequenceStatus();

                levelCompleteTimer = setTimeout(() => {
                    levelCompleteTimer = null;
                    hideLevelCompleteModal();

                    if (pendingLevelAfterComplete) {
                        const level = pendingLevelAfterComplete;
                        pendingLevelAfterComplete = null;
                        setActiveLevel(level.id, { showIntro: true });
                        startMainThemeFromGameStart();
                        return;
                    }

                    levelTransitionActive = false;
                    renderSequenceStatus();
                    renderWordList();
                }, LEVEL_COMPLETE_DURATION_MS);
            }

            function showFinalVictoryScreen() {
                hideLevelCompleteModal();
                clearLevelCompleteTimer();
                clearFinalVictoryTimer();
                levelTransitionActive = true;
                deadline = null;
                stopSequenceTimer();
                stopRoadAnimation();
                stopMemoryPhraseSystem();
                pendingLevelAfterComplete = null;

                if (finalVictoryUnicode) {
                    finalVictoryUnicode.textContent = createUnicodeLines({
                        environment: "border-fence",
                        state: "success",
                        distortion: 0,
                        now: Date.now(),
                    }).join("\n");
                }
                if (finalVictoryLineOne) {
                    finalVictoryLineOne.textContent =
                        "Woohoo! You deleted your data from the server and beat the system!";
                }
                if (finalVictoryLineTwo) {
                    finalVictoryLineTwo.textContent =
                        "Now Unicode can roam free in the great digital sea!";
                }
                finalVictoryLineOne?.classList.remove("visible");
                finalVictoryLineTwo?.classList.remove("visible");
                finalVictoryPlayAgain?.classList.remove("visible");
                finalVictoryScreen?.classList.add("visible");
                finalVictoryScreen?.setAttribute("aria-hidden", "false");
                playFinalVictoryTransition?.();
                levelCompleteSoundPlayed = true;
                renderSequenceStatus();

                finalVictoryTimer = setTimeout(() => {
                    finalVictoryLineOne?.classList.add("visible");
                    finalVictoryTimer = setTimeout(() => {
                        finalVictoryLineTwo?.classList.add("visible");
                        finalVictoryPlayAgain?.classList.add("visible");
                        finalVictoryPlayAgain?.focus();
                        finalVictoryTimer = null;
                    }, FINAL_VICTORY_FIRST_LINE_MS);
                }, 120);
            }

            function triggerVoiceSignal(state = "speaking") {
                keygenCharacter.triggerVoiceSignal(state);
                if (state === "success") {
                    showUnicodeFeedback("success");
                }
            }

            function triggerKeygenFail() {
                keygenCharacter.triggerFail();
                showUnicodeFeedback("fail");
            }

            function triggerKeygenCollisionFail() {
                keygenCharacter.triggerCollisionFail();
                showUnicodeFeedback("fail");
                playLevelFailedSound();
            }

            function triggerKeygenRespawn() {
                keygenCharacter.triggerRespawn();
            }

            function updateKeygenDistortion(level) {
                keygenCharacter.setDistortion(
                    getKeygenDistortionForLevel(level),
                );
            }

            function checkWallKeygenCollision(wallRow, metrics) {
                if (
                    !isSequenceMode() ||
                    sequenceFailed ||
                    wordCaughtThisBeat ||
                    !deadline
                ) {
                    return false;
                }

                const now = Date.now();

                if (now - lastKeygenHitAt < KEYGEN_HIT_COOLDOWN_MS) {
                    return false;
                }

                const keygenBounds = getPlayerBounds(metrics);
                if (
                    !obstacleIntersectsPlayer({
                        wallRow,
                        wallHeight: WALL_HEIGHT,
                        playerBounds: keygenBounds,
                    })
                ) {
                    return false;
                }

                lastKeygenHitAt = now;
                triggerKeygenCollisionFail();
                console.log("[collision] level obstacle hit player");
                handleDeadline();
                return true;
            }

            function renderScoreDisplay(entries = getTargetEntries()) {
                renderScoreDisplayView({
                    scoreDisplay,
                    entries,
                    isSequenceMode: isSequenceMode(),
                    currentWordIndex,
                    caughtWords,
                    currentLevel,
                    completedPhrasesFromLevel1,
                });
            }

            function getPlayerBounds(metrics = getRoadMetrics()) {
                return getPlayerBoundsFromMetrics(
                    metrics,
                    getLevelConfig().environment,
                );
            }

            function renderWordList() {
                renderWordListView({
                    wordList,
                    entries: getTargetEntries(),
                    currentWordIndex,
                    caughtWords,
                    sequenceFailed,
                    isSequenceMode: isSequenceMode(),
                });
            }

            function renderTranscript() {
                renderTranscriptView({
                    finalText,
                    interimText,
                    gameOverTranscript,
                    text: getSelectedTranscriptText(),
                    words: getTargetWords(),
                    escapeRegExp,
                    colorSpan,
                });
            }

            function renderTranscriptInto(container, text, words) {
                renderTranscriptIntoView({
                    container,
                    text,
                    words,
                    escapeRegExp,
                    colorSpan,
                });
            }

            function clearTranscript() {
                transcriptState.clear();
                interimText.textContent = "";
                renderTranscript();
            }

            function getSelectedTranscriptText() {
                return transcriptState.getSelected(transcriptSourceInput.value);
            }

            function getSentenceFuzzyThreshold() {
                return readConfig(refs).sentenceFuzzyThreshold;
            }

            function findTargetEnd(text, target, fromIndex = 0) {
                return findTargetEndInText(text, target, {
                    fromIndex,
                    fuzzyThreshold: getSentenceFuzzyThreshold(),
                });
            }

            function textMatchesTarget(text, target) {
                return textMatchesTargetText(text, target, {
                    fuzzyThreshold: getSentenceFuzzyThreshold(),
                });
            }

            function catchWords(text) {
                if (levelTransitionActive) {
                    return;
                }

                const result = consumeCatchText(
                    caughtWords,
                    getTargetEntries()
                        .filter((entry) => !entry.soundOnly)
                        .map((entry) => entry.text),
                    text,
                    textMatchesTarget,
                );

                if (result.changed) {
                    triggerVoiceSignal("success");
                    maybeTriggerTalkback("beat");
                }
            }

            function isSoundPhraseTargetActive() {
                if (
                    !gameStarted ||
                    !isSequenceMode() ||
                    sequenceFailed ||
                    levelTransitionActive
                ) {
                    return false;
                }

                const entry = getCurrentTargetEntry();
                if (!entry || !entry.soundOnly) {
                    return false;
                }

                // In beat modes the wall is already cleared for this beat.
                return !(isBeatMode() && wordCaughtThisBeat);
            }

            // Drives sound-only ("*hmmm*") targets from the live mic level: a
            // sustained vocalization clears the current wall instead of a
            // transcript match.
            function detectSoundPhrase(amplitude, timestamp) {
                if (!isSoundPhraseTargetActive()) {
                    vocalizationDetector.reset();
                    return;
                }

                if (vocalizationDetector.sample(amplitude, timestamp)) {
                    catchCurrentTarget();
                }
            }

            function catchCurrentTarget() {
                const words = getTargetWords();
                const state = createRuleStateSnapshot();
                const result = markCurrentWordCaughtRule(
                    state,
                    words,
                    modeInput.value,
                );
                applyRuleState(state);

                if (!result.changed) {
                    return result;
                }

                triggerVoiceSignal("success");
                maybeTriggerTalkback("beat");

                if (isBeatMode()) {
                    // Caught this beat — the deadline handler advances/refills,
                    // exactly as for a spoken word.
                    registerCaughtBeat();
                    renderSequenceStatus();
                    return result;
                }

                // Continuous mode: advance now, mirroring processSequenceText.
                levelProgressionEffects.registerSuccessfulPhrase();
                refillLivesAndRetries();
                playWallPassSound();

                if (result.completed) {
                    completeSequence();
                } else {
                    startSequenceTimer();
                }

                renderSequenceStatus();
                renderWordList();
                fireDueTalkbackCues();
                return result;
            }

            function getSecondsLimit() {
                return readConfig(refs).seconds * 1.15;
            }

            function getLivesLimit() {
                return readConfig(refs).lives;
            }

            function getRetriesLimit() {
                return readConfig(refs).retries;
            }

            function registerCaughtBeat() {
                const caughtAt = Date.now();
                gateOpenedAt = caughtAt;
                deadline = getCaughtBeatDeadline(deadline, caughtAt);
                playWallPassSound();
            }

            function refillLivesAndRetries() {
                livesLeft = getLivesLimit();
                retriesLeft = getRetriesLimit();
                refillAnimationUntil = Date.now() + 780;
            }

            function getContinuePhrase() {
                return readConfig(refs).continuePhrase;
            }

            function isSequenceMode() {
                return modeInput.value !== "catch";
            }

            function isBeatMode() {
                return (
                    modeInput.value === "rhythm" || modeInput.value === "lives"
                );
            }

            function textHasWord(text, word) {
                return textMatchesTarget(text, word);
            }

            function findWordEnd(text, word, fromIndex) {
                return findTargetEnd(text, word, fromIndex);
            }

            function stopSequenceTimer() {
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
            }

            function clearGameOverContinueTimer() {
                if (gameOverContinueTimer) {
                    clearTimeout(gameOverContinueTimer);
                    gameOverContinueTimer = null;
                }
                gameOverContinuing = false;
            }

            function renderGameOverScreen() {
                renderGameOverScreenView({
                    refs,
                    sequenceFailed,
                    gameOverContinuing,
                    isSequenceMode: isSequenceMode(),
                    words: getTargetWords(),
                    currentWordIndex,
                    continuePhrase: getContinuePhrase(),
                    updateGameOverFire,
                });
            }

            function resetSequence() {
                clearGameOverContinueTimer();
                clearLevelCompleteTimer();
                hideLevelCompleteModal();
                clearWordGameOverCounts(gameOverCountsByWord);
                gameOverRecorded = false;
                const state = createRuleStateSnapshot();
                resetSequenceRule(state, {
                    livesLimit: getLivesLimit(),
                    retriesLimit: getRetriesLimit(),
                });
                applyRuleState(state);
                deadline = null;
                wordStartedAt = 0;
                gateOpenedAt = 0;
                refillAnimationUntil = 0;
                firedTalkbackCues.clear();
                prefetchedTalkbackCues.clear();
                vocalizationDetector.reset();
                levelProgressionEffects.reset(currentLevel);
                level3WarningShown = currentLevel !== 3;

                if (modeInput.value === "catch") {
                    catchWords(getSelectedTranscriptText());
                }

                stopSequenceTimer();
                renderSequenceStatus();
                renderWordList();
                renderGameOverScreen();
            }

            function failSequence(reason) {
                clearGameOverContinueTimer();
                clearTranscript();
                if (!gameOverRecorded) {
                    recordWordGameOver(
                        gameOverCountsByWord,
                        currentWordIndex,
                    );
                    gameOverRecorded = true;
                }
                sequenceFailed = true;
                failReason = reason || "timeout";
                deadline = null;
                wordStartedAt = 0;
                triggerKeygenFail();
                playLevelFailedSound();
                stopSequenceTimer();
                renderSequenceStatus();
                renderWordList();
                renderGameOverScreen();
            }

            function completeSequence() {
                clearGameOverContinueTimer();
                deadline = null;
                wordStartedAt = 0;
                stopSequenceTimer();
                const nextLevel = getNextLevel(getLevels(), currentLevel);

                if (!nextLevel) {
                    showFinalVictoryScreen();
                    return;
                }

                showLevelCompleteModal({
                    final: false,
                    nextLevel,
                });
            }

            function continueFromGameOver() {
                if (
                    !sequenceFailed ||
                    !isSequenceMode() ||
                    gameOverContinuing
                ) {
                    return false;
                }

                gameOverContinuing = true;
                renderGameOverScreen();
                renderSequenceStatus();

                gameOverContinueTimer = setTimeout(() => {
                    const autoPassCurrentWord = shouldAutoPassWord(
                        gameOverCountsByWord,
                        currentWordIndex,
                    );
                    const state = createRuleStateSnapshot();
                    acceptContinuePhraseRule(state, {
                        livesLimit: getLivesLimit(),
                        retriesLimit: getRetriesLimit(),
                    });
                    applyRuleState(state);
                    gameOverContinueTimer = null;
                    gameOverContinuing = false;
                    gameOverRecorded = false;
                    gateOpenedAt = 0;
                    wallEchoFiredThisBeat = false;
                    triggerKeygenRespawn();
                    playRespawnSound();
                    renderGameOverScreen();

                    if (autoPassCurrentWord) {
                        if (isBeatMode()) {
                            startSequenceTimer();
                        }
                        catchCurrentTarget();
                    } else if (currentWordIndex < getTargetWords().length) {
                        startSequenceTimer();
                    } else {
                        completeSequence();
                    }

                    renderSequenceStatus();
                    renderWordList();
                }, 1450);
                return true;
            }

            function checkContinuePhrase(text) {
                if (
                    !sequenceFailed ||
                    !isSequenceMode() ||
                    !textMatchesTarget(text, getContinuePhrase())
                ) {
                    return false;
                }

                return continueFromGameOver();
            }

            function handleDeadline() {
                if (!isBeatMode()) {
                    failSequence();
                    return;
                }

                const words = getTargetWords();
                const wasCaught = wordCaughtThisBeat;
                const state = createRuleStateSnapshot();
                const result = handleBeatDeadlineRule(state, words, {
                    mode: modeInput.value,
                    livesLimit: getLivesLimit(),
                    retriesLimit: getRetriesLimit(),
                });
                const failureReason = state.failReason;
                applyRuleState(state);

                if (result.outcome === "failed") {
                    failSequence(failureReason);
                    return;
                }

                if (wasCaught) {
                    levelProgressionEffects.registerSuccessfulPhrase();
                    gateOpenedAt = 0;
                    refillLivesAndRetries();

                    if (result.outcome === "completed") {
                        completeSequence();
                        return;
                    }

                    startSequenceTimer();
                    wallEchoFiredThisBeat = false;
                    maybeTriggerEcho("beat");
                    maybeTriggerTalkback("beat");
                    renderSequenceStatus();
                    renderWordList();
                    fireDueTalkbackCues();
                    return;
                }

                if (result.outcome === "completed") {
                    completeSequence();
                    return;
                }

                startSequenceTimer();
                wallEchoFiredThisBeat = false;
                maybeTriggerEcho("life");
                maybeTriggerTalkback("life");
                renderSequenceStatus();
                renderWordList();
            }

            function startSequenceTimer() {
                stopSequenceTimer();

                if (
                    levelTransitionActive ||
                    sequenceFailed ||
                    currentWordIndex >= getTargetWords().length
                ) {
                    deadline = null;
                    wordStartedAt = 0;
                    return;
                }

                wordStartedAt = Date.now();
                deadline = wordStartedAt + getSecondsLimit() * 1000;
                roadAnimation.reset();
                wallEchoFiredThisBeat = false;
                startRoadAnimation();
                timerInterval = setInterval(() => {
                    if (deadline && Date.now() >= deadline) {
                        handleDeadline();
                        return;
                    }

                    if (
                        deadline &&
                        !wordCaughtThisBeat &&
                        !wallEchoFiredThisBeat &&
                        (deadline - Date.now()) / 1000 <= getSecondsLimit() / 2
                    ) {
                        wallEchoFiredThisBeat = true;
                        maybeTriggerEcho("wall");
                        maybeTriggerTalkback("wall");
                    }

                    renderSequenceStatus();
                }, 100);
                renderSequenceStatus();
            }

            function renderSequenceStatus() {
                const entries = getTargetEntries();
                const words = entries.map((entry) => entry.text);
                renderLevelStatus(entries);
                levelProgressionEffects.syncLevelEffects();
                renderTimeline(words);
                renderSequenceStatusText({
                    sequenceStatus,
                    entries,
                    words,
                    isSequenceMode: isSequenceMode(),
                    sequenceFailed,
                    failReason,
                    currentWordIndex,
                    currentEntry: getCurrentTargetEntry(entries),
                    deadline,
                    mode: modeInput.value,
                    livesLeft,
                    retriesLeft,
                    wordCaughtThisBeat,
                    now: Date.now(),
                });
            }

            function colorSpan(className, text) {
                const span = document.createElement("span");
                span.className = className;
                span.textContent = text;
                return span;
            }

            function renderRoad(word, wallRow, gateProgress = null) {
                const currentEntry = getCurrentTargetEntry();
                const displayWord =
                    word && currentEntry && currentEntry.soundOnly
                        ? `~ ${word} ~`
                        : word;
                renderRoadScene({
                    timeline,
                    doc: document,
                    word: displayWord,
                    wallRow,
                    gateProgress,
                    metrics: getRoadMetrics(),
                    environment: getLevelConfig().environment,
                    playerState: keygenCharacter.getRenderState(),
                    now: Date.now(),
                });
            }

            function renderLivesDisplay() {
                renderLivesDisplayView({
                    livesDisplay,
                    mode: modeInput.value,
                    livesLimit: getLivesLimit(),
                    livesLeft,
                    retriesLeft,
                    refillAnimationUntil,
                    now: Date.now(),
                    colorSpan,
                });
            }

            function renderTimeline(words = getTargetWords()) {
                renderLivesDisplay();
                renderScoreDisplay(getTargetEntries());

                const metrics = getRoadMetrics();
                const state = createTimelineRenderState({
                    levelTransitionActive,
                    sequenceMode: isSequenceMode(),
                    mode: modeInput.value,
                    deadline,
                    wordStartedAt,
                    secondsLimit: getSecondsLimit(),
                    now: Date.now(),
                    metrics,
                    words,
                    currentWordIndex,
                    sequenceFailed,
                    wordCaughtThisBeat,
                    gateOpenedAt,
                    gateAnimationMs: GATE_ANIM_MS,
                    beatMode: isBeatMode(),
                });

                if (state.timelineText !== null) {
                    timelineState.textContent = state.timelineText;
                }
                timerDisplay.textContent = state.timerText;

                if (
                    state.checkCollision &&
                    checkWallKeygenCollision(state.road.wallRow, metrics)
                ) {
                    renderTimeline(getTargetWords());
                    return;
                }

                renderRoad(
                    state.road.word,
                    state.road.wallRow,
                    state.road.gateProgress,
                );
            }

            function processSequenceText(text) {
                if (
                    !isSequenceMode() ||
                    sequenceFailed ||
                    levelTransitionActive
                ) {
                    return false;
                }

                // Sound-only targets are cleared by vocalization, never text.
                if (getCurrentTargetEntry()?.soundOnly) {
                    return false;
                }

                const words = getTargetWords();
                const state = createRuleStateSnapshot();
                const result = consumeSequenceText(state, words, text, {
                    mode: modeInput.value,
                    findWordEnd,
                });
                applyRuleState(state);

                if (isBeatMode()) {
                    if (result.beatHit) {
                        registerCaughtBeat();
                        triggerVoiceSignal("success");
                        maybeTriggerTalkback("beat");
                    }
                    renderSequenceStatus();
                    return result.changed;
                }

                for (let i = 0; i < result.completedPhrases.length; i += 1) {
                    levelProgressionEffects.registerSuccessfulPhrase();
                    refillLivesAndRetries();
                    triggerVoiceSignal("success");
                    playWallPassSound();
                    maybeTriggerTalkback("beat");
                }

                if (result.completed) {
                    completeSequence();
                } else if (result.changed) {
                    startSequenceTimer();
                }

                renderSequenceStatus();
                fireDueTalkbackCues();
                return result.changed;
            }

            function processTranscriptText(text) {
                if (!text.trim()) {
                    return;
                }

                if (checkContinuePhrase(text)) {
                    return;
                }

                if (isSequenceMode()) {
                    processSequenceText(text);
                } else {
                    catchWords(text);
                }
            }

            function rebuildCatchWordsFromSource() {
                caughtWords.clear();

                if (transcriptSourceInput.value === "interim") {
                    catchWords(transcriptState.interimTranscript);
                    return;
                }

                for (const chunk of transcriptState.finalChunks) {
                    catchWords(chunk);
                }
            }

            function drawIdleVisualizer() {
                microphoneVisualizer.startIdle();
            }

            function updateAsciiWaveformBackground(
                amplitude = 0,
                timestamp = performance.now(),
            ) {
                updateAsciiWaveformBackgroundView({
                    element: asciiWaveformBackground,
                    currentLevel,
                    amplitude,
                    timestamp,
                    viewportWidth: window.innerWidth,
                });
            }

            function updateGameOverWaveform(
                amplitude = 0.4,
                timestamp = performance.now(),
            ) {
                lastGameOverFireFrame = updateGameOverWaveformView({
                    visualizerElement: gameOverVisualizer,
                    fireElement: gameOverFire,
                    createScaryFireFrames,
                    wallFireFrameCount: WALL_FIRE_FRAMES.length,
                    lastFireFrameIndex: lastGameOverFireFrame,
                    amplitude,
                    timestamp,
                    viewportWidth: window.innerWidth,
                });
            }

            function updateGameOverFire(force = false) {
                lastGameOverFireFrame = updateGameOverFireView({
                    element: gameOverFire,
                    createScaryFireFrames,
                    wallFireFrameCount: WALL_FIRE_FRAMES.length,
                    lastFrameIndex: lastGameOverFireFrame,
                    force,
                    now: Date.now(),
                    viewportWidth: window.innerWidth,
                });
            }

            function stopMemoryPhraseSystem() {
                memoryPhraseSystem.stop();
            }

            function startMemoryPhraseSystem(useMockMemories = false) {
                memoryPhraseSystem.start(useMockMemories);
            }

            async function startVisualizer() {
                if (microphoneVisualizer.isActive()) {
                    return;
                }

                await microphoneVisualizer.start();
            }

            function stopVisualizer() {
                microphoneVisualizer.stop();
            }

            const ECHO_MIME = getPreferredEchoMimeType(window.MediaRecorder);
            const echoRuntime = createEchoRuntime({
                panel: echoPanel,
                header: echoHeader,
                rows: echoRows,
                getEnabled: () => echoEnabled(),
                getMode: () => echoModeInput.value,
                getMicStream,
                getAudioContext,
                getProgress: () => getEchoProgress(),
                getCurrentWord: () =>
                    isSequenceMode() && !sequenceFailed
                        ? getTargetWords()[currentWordIndex]
                        : null,
                getFallbackLabel: () =>
                    transcriptState.interimTranscript
                        .split(" ")
                        .slice(-6)
                        .join(" ") || "…",
                textHasWord,
                onRandomTick: () => {
                    maybeTriggerTalkback("random");
                },
                mimeType: ECHO_MIME,
                MediaRecorderClass: window.MediaRecorder,
                config: ECHO_RUNTIME_CONFIG,
            });
            const talkbackRuntime = createTalkbackRuntime({
                endpointStatus: talkbackEndpointStatus,
                referenceStatus: talkbackReferenceStatus,
                voiceStatus: talkbackVoiceStatus,
                lastStatus: talkbackLastStatus,
                getEnabled: () => talkbackEnabled(),
                getEndpoint: () => getTalkbackEndpoint(),
                getThreshold: () => getTalkbackThreshold(),
                getPhrases: () => getTalkbackPhrases(),
                getFrequency: () =>
                    getLevelConfig().talkbackFrequency ?? 1,
                getProgress: () => getTalkbackProgress(),
                getMicStream,
                getAudioContext,
                getPlaybackAudioContext: () =>
                    AudioManager.getAudioContext() || getAudioContext(),
                mimeType: ECHO_MIME,
                MediaRecorderClass: window.MediaRecorder,
                AudioClass: window.Audio,
                BlobClass: window.Blob,
                config: TALKBACK_RUNTIME_CONFIG,
            });

            function talkbackEnabled() {
                return readConfig(refs).talkbackEnabled;
            }

            function renderTalkbackPanel() {
                talkbackRuntime.render();
            }

            function getTalkbackEndpoint() {
                return readConfig(refs).talkbackEndpoint;
            }

            function getTalkbackThreshold() {
                return readConfig(refs).talkbackThreshold;
            }

            function getTalkbackProgress() {
                if (isSequenceMode()) {
                    return Math.min(
                        getTargetWords().length,
                        currentWordIndex + (wordCaughtThisBeat ? 1 : 0),
                    );
                }

                return caughtWords.size;
            }

            function getTalkbackPhrases() {
                return getLevelConfig().talkbackRandom || [];
            }

            function checkTalkbackHealth() {
                return talkbackRuntime.checkHealth();
            }

            function startTalkbackHealthChecks() {
                talkbackRuntime.startHealthChecks();
            }

            function startTalkbackCaptureSystem() {
                talkbackRuntime.startCapture();
            }

            function stopTalkbackCaptureSystem() {
                talkbackRuntime.stopCapture();
            }

            function cutTalkbackSegment(label) {
                talkbackRuntime.cutSegment(label);
            }

            function maybeTriggerTalkback(kind) {
                talkbackRuntime.maybeTrigger(kind);
            }

            // Fire any scripted talk-back cues whose anchor word the player has
            // now passed. Cues fire once per playthrough and are queued by the
            // talk-back runtime, so they never interrupt the game loop.
            function fireDueTalkbackCues() {
                if (
                    !gameStarted ||
                    levelTransitionActive ||
                    !isSequenceMode()
                ) {
                    return;
                }

                const cues = getLevelConfig().talkbackCues || [];

                for (let i = 0; i < cues.length; i += 1) {
                    if (
                        !firedTalkbackCues.has(i) &&
                        cues[i].afterIndex < currentWordIndex
                    ) {
                        firedTalkbackCues.add(i);
                        talkbackRuntime.triggerSpecific(cues[i].text);
                    } else if (
                        !firedTalkbackCues.has(i) &&
                        !prefetchedTalkbackCues.has(i) &&
                        cues[i].afterIndex === currentWordIndex
                    ) {
                        prefetchedTalkbackCues.add(i);
                        talkbackRuntime.prefetchSpecific(cues[i].text);
                    }
                }
            }

            function echoEnabled() {
                return echoModeInput.value !== "off";
            }

            function startEchoSystem() {
                echoRuntime.start();
            }

            function stopEchoSystem() {
                echoRuntime.stop();
            }

            function cutEchoSnippet(label) {
                echoRuntime.cutSnippet(label);
            }

            function renderEchoPanel() {
                echoRuntime.render();
            }

            function getEchoProgress() {
                const words = getTargetWords();

                if (!words.length) {
                    return 0;
                }

                if (isSequenceMode()) {
                    return Math.min(1, currentWordIndex / words.length);
                }

                return Math.min(1, caughtWords.size / words.length);
            }

            function maybeTriggerEcho(kind) {
                echoRuntime.maybeTrigger(kind);
            }

            function clearEchoSnippets() {
                echoRuntime.clearSnippets();
            }

            bindControlEvents({
                refs,
                win: window,
                handlers: {
                    resetSequence,
                    getMode: () => modeInput.value,
                    rebuildCatchWordsFromSource,
                    renderWordList,
                    renderTranscript,
                    restartSequenceIfListening,
                    shouldRestartTimerOnSecondsChange: () =>
                        isSequenceMode() && deadline && !sequenceFailed,
                    startSequenceTimer,
                    renderSequenceStatus,
                    processSelectedTranscriptText: () => {
                        processTranscriptText(getSelectedTranscriptText());
                    },
                    renderGameOverScreen,
                    echoEnabled,
                    stopEchoSystem,
                    getMicStream,
                    echoIsRecording: () => echoRuntime.isRecording(),
                    startEchoSystem,
                    talkbackEnabled,
                    stopTalkbackCaptureSystem,
                    startTalkbackCaptureSystem,
                    checkTalkbackHealth,
                    renderTalkbackPanel,
                    resetTalkbackEndpoint: () => {
                        talkbackRuntime.resetEndpoint();
                    },
                    markTalkbackEndpointChecking: () => {
                        talkbackRuntime.markEndpointChecking();
                    },
                    maybeTriggerTalkback,
                    openSettings,
                    closeSettings,
                    persistScript,
                    resetScriptToFile,
                },
            });

            function startMainThemeFromGameStart() {
                startMainTheme().catch((error) => {
                    console.warn("[audio] Main theme could not start.", error);
                });
            }

            function startOnboardingVoiceRecognition() {
                if (
                    !speechService.isSupported() ||
                    recognitionState.listening ||
                    recognitionState.starting ||
                    gameStarted
                ) {
                    return;
                }

                try {
                    recognitionState.starting = true;
                    recognitionStartedAt = Date.now();
                    console.log("[voice] starting onboarding recognition");
                    speechService.start();
                } catch (error) {
                    recognitionState.starting = false;
                    console.warn(
                        "[voice] onboarding recognition could not start",
                        error,
                    );
                }
            }

            async function startGame({
                levelId = 1,
                useMockMemories = false,
                showHeroIntro = levelId === 1,
            } = {}) {
                if (!speechService.isSupported()) {
                    status.textContent =
                        "Speech recognition is not supported in this browser. Try Chrome or Edge.";
                    return;
                }

                if (gameStarted && !stopButton.disabled) {
                    return;
                }

                gameStarted = true;
                if (onboardingRestartTimer) {
                    clearTimeout(onboardingRestartTimer);
                    onboardingRestartTimer = null;
                }
                hideOnboarding();
                if (showHeroIntro && levelId === 1) {
                    showHeroIntroBeforeLevel(levelId, useMockMemories);
                } else {
                    setActiveLevel(levelId, {
                        showIntro: true,
                        useMockMemories,
                    });
                }
                startMainThemeFromGameStart();

                try {
                    await startVisualizer();
                    startEchoSystem();
                    startTalkbackCaptureSystem();
                    if (!recognitionState.listening && !recognitionState.starting) {
                        recognitionState.starting = true;
                        speechService.start();
                    } else if (recognitionState.listening) {
                        // Recognition was already listening from the opening
                        // modal — flip to the in-game listening UI state.
                        status.textContent = "Listening...";
                        startButton.disabled = true;
                        stopButton.disabled = false;
                        startRoadAnimation();

                        if (
                            isSequenceMode() &&
                            getTargetWords().length &&
                            !deadline &&
                            !sequenceFailed &&
                            !levelTransitionActive
                        ) {
                            startSequenceTimer();
                        }
                    }
                } catch (error) {
                    status.textContent =
                        "Microphone access was blocked or unavailable.";
                    stopEchoSystem();
                    stopTalkbackCaptureSystem();
                    stopVisualizer();
                }
            }

            function startGameFromOnboarding() {
                startGame();
            }

            function jumpToLevel(levelId) {
                if (!getLevels().some((level) => level.id === levelId)) {
                    return;
                }

                const useMockMemories =
                    resolveEnvironment(getLevelConfig(levelId).environment)
                        .memoryEnemies && completedPhrasesFromLevel1.length === 0;

                if (!gameStarted) {
                    startGame({
                        levelId,
                        useMockMemories,
                        showHeroIntro: false,
                    });
                    return;
                }

                setActiveLevel(levelId, {
                    showIntro: true,
                    useMockMemories,
                });
                startMainThemeFromGameStart();
            }

            function syncDevLevelButtons() {
                if (!devLevelButtons) {
                    return;
                }

                devLevelButtons.style.display = DEV_MODE ? "flex" : "none";

                if (!DEV_MODE) {
                    devLevelButtons.replaceChildren();
                    return;
                }

                const buttons = getLevels().map((level) => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.textContent = `LVL ${level.id}`;
                    button.addEventListener("click", () =>
                        jumpToLevel(level.id),
                    );
                    return button;
                });
                devLevelButtons.replaceChildren(...buttons);
            }

            function persistScript() {
                saveScriptOverride(refs.wordsInput.value);
                syncDevLevelButtons();
            }

            function resetScriptToFile() {
                fetchFileScript()
                    .then((text) => {
                        clearScriptOverride();
                        refs.wordsInput.value = text;
                        resetSequence();

                        if (modeInput.value === "catch") {
                            rebuildCatchWordsFromSource();
                        }

                        syncDevLevelButtons();
                        renderWordList();
                        renderTranscript();
                        restartSequenceIfListening();
                    })
                    .catch((error) => {
                        console.error(
                            "[game-script] Could not reset to game-script.md.",
                            error,
                        );
                    });
            }

            function debugCompleteCurrentPhrase() {
                if (!DEV_MODE || levelTransitionActive || sequenceFailed) {
                    return;
                }

                const words = getTargetWords();
                const phrase = words[currentWordIndex];

                if (!phrase) {
                    return;
                }

                caughtWords.add(phrase.toLowerCase());
                recordCompletedPhrase(phrase);
                currentWordIndex += 1;
                levelProgressionEffects.registerSuccessfulPhrase();
                wordCaughtThisBeat = false;
                gateOpenedAt = Date.now();
                triggerVoiceSignal("success");
                playWallPassSound();

                if (currentWordIndex >= words.length) {
                    completeSequence();
                } else {
                    startSequenceTimer();
                    renderSequenceStatus();
                    renderWordList();
                    fireDueTalkbackCues();
                }
            }

            function debugCompleteLevel1() {
                if (!DEV_MODE) {
                    return;
                }

                if (currentLevel !== 1) {
                    setActiveLevel(1, { showIntro: false });
                }

                for (const phrase of getTargetWords()) {
                    recordCompletedPhrase(phrase);
                    caughtWords.add(phrase.toLowerCase());
                }

                currentWordIndex = getTargetWords().length;
                completeSequence();
            }

            function startGameFromVoice() {
                if (gameStarted) {
                    return;
                }

                console.log("[voice] START command triggered game start");
                startGameFromOnboarding();
            }

            function restartGameFromVictory() {
                hideFinalVictoryScreen();
                completedPhrasesFromLevel1.length = 0;
                caughtWords.clear();
                firedTalkbackCues.clear();
                prefetchedTalkbackCues.clear();
                clearTranscript();
                stopSequenceTimer();
                clearGameOverContinueTimer();
                clearWordGameOverCounts(gameOverCountsByWord);
                showHeroIntroBeforeLevel(1, false);
                AudioManager.setMusicLevel?.(1);
                startMainThemeFromGameStart();
                renderGameOverScreen();
                renderWordList();
                renderSequenceStatus();
            }

            function normalizeVoiceCommand(text) {
                return normalizeVoiceCommandText(text);
            }

            function isStartCommand(text) {
                return isStartCommandText(text);
            }

            bindActionEvents({
                refs,
                doc: document,
                handlers: {
                    startGame,
                    stopSpeech: () => speechService.stop(),
                    clearTranscript,
                    clearEchoSnippets,
                    clearTalkback: () => talkbackRuntime.clear(),
                    resetSequence,
                    restartSequenceIfListening,
                    startGameFromOnboarding,
                    jumpToLevel,
                    gameStarted: () => gameStarted,
                    onboardingVisible: () =>
                        !onboardingScreen.classList.contains("hidden"),
                    devMode: () => DEV_MODE,
                    isEditingTarget: (target) =>
                        target instanceof HTMLInputElement ||
                        target instanceof HTMLTextAreaElement ||
                        target instanceof HTMLSelectElement,
                    debugCompleteCurrentPhrase,
                    debugCompleteLevel1,
                },
            });

            aboutTitleButton?.addEventListener("click", openAboutModal);
            aboutTitleButton?.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openAboutModal();
                }
            });
            aboutCloseButton?.addEventListener("click", closeAboutModal);
            aboutBackButton?.addEventListener("click", closeAboutModal);
            finalVictoryPlayAgain?.addEventListener(
                "click",
                restartGameFromVictory,
            );
            aboutScreen?.addEventListener("click", (event) => {
                if (event.target === aboutScreen) {
                    closeAboutModal();
                }
            });
            document.addEventListener("keydown", (event) => {
                if (
                    event.key === "Escape" &&
                    aboutScreen?.classList.contains("visible")
                ) {
                    closeAboutModal();
                }
            });

            syncDevLevelButtons();

            if (DEV_MODE) {
                console.info(
                    "[dev] Level shortcuts: 1 = Level 1, 2 = Level 2, ] = complete phrase, L = complete Level 1",
                );
            }

            renderWordList();
            renderSequenceStatus();
            renderTalkbackPanel();
            startTalkbackHealthChecks();
            AudioManager.preloadAll();
            drawIdleVisualizer();
            micInitAction.focus();

            const handleRecognitionResult = createRecognitionResultHandler({
                transcriptState,
                isGameStarted: () => gameStarted,
                isStartCommand,
                startGameFromVoice,
                getTranscriptSource: () => transcriptSourceInput.value,
                getMode: () => modeInput.value,
                triggerVoiceSignal,
                processTranscriptText,
                rebuildCatchWordsFromSource,
                renderTranscript,
                renderWordList,
                cutEchoSnippet,
                cutTalkbackSegment,
            });

            const speechService = createSpeechService({
                callbacks: createSpeechServiceCallbacks({
                    recognitionState,
                    status,
                    startButton,
                    stopButton,
                    interimText,
                    isGameStarted: () => gameStarted,
                    isOnboardingVoiceBlocked: () => onboardingVoiceBlocked,
                    setOnboardingVoiceBlocked(value) {
                        onboardingVoiceBlocked = value;
                    },
                    scheduleOnboardingRestart:
                        scheduleOnboardingRecognitionRestart,
                    triggerVoiceSignal,
                    startRoadAnimation,
                    shouldStartSequenceTimer: () =>
                        isSequenceMode() &&
                        getTargetWords().length &&
                        !deadline &&
                        !sequenceFailed &&
                        !levelTransitionActive,
                    startSequenceTimer,
                    stopEchoSystem,
                    stopTalkbackCaptureSystem,
                    stopVisualizer,
                    drawIdleVisualizer,
                    onResult: handleRecognitionResult,
                }),
            });
            activeRecognition = speechService.ensureRecognition();

            if (!speechService.isSupported()) {
                status.textContent =
                    "Speech recognition is not supported in this browser. Try Chrome or Edge.";
                startButton.disabled = true;
            }

            // The mic + sound engine are only started from the one-time
            // "initialize microphone" tap (a real user gesture), so audio can
            // later start even from a spoken "start". This gate shows once per
            // page load — game-over / restart never bring it back.
            micInitAction.addEventListener("click", initializeMicAndAudio);
            audioResumeAction?.addEventListener("click", () => {
                // Keep the retry call directly inside the click handler so
                // iOS Safari sees it as user-initiated media playback.
                AudioManager.retryPendingAudioFromGesture();
            });
}
