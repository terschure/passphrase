import { createMusicManager } from "../audio/musicManager.js";
import { bindActionEvents } from "./actionBindings.js";
import { bindControlEvents } from "./controlBindings.js";
import { createLevelCatalog } from "../content/levelCatalog.js";
import {
    LEVEL_1_WORD_COUNT as DEFAULT_LEVEL_1_WORD_COUNT,
    LEVEL_2_ROUNDS as DEFAULT_LEVEL_2_ROUNDS,
    parseTargetPlan as parseTargetPlanFromText,
} from "../content/targetPlan.js";
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
    createInitialGameState,
    handleBeatDeadline as handleBeatDeadlineRule,
    recordCompletedPhrase as recordCompletedPhraseRule,
    resetSequence as resetSequenceRule,
} from "../game/rules.js";
import { consumeSequenceText } from "../game/sequenceText.js";
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
    showOnboardingStep as showOnboardingStepView,
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
                talkbackPhrasesInput,
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
                devLevel1Button,
                devLevel2Button,
                status,
                finalText,
                interimText,
                asciiWaveformBackground,
                gameOverVisualizer,
            } = refs;
            const transcriptState = createTranscriptState();
            const caughtWords = new Set();
            const DEV_MODE = true;
            const LEVEL_1_WORD_COUNT = DEFAULT_LEVEL_1_WORD_COUNT;
            const LEVEL_INTRO_DURATION_MS = 1800;
            const LEVEL_2_AUDIO_DEGRADATION_START = 0;
            const LEVEL_2_AUDIO_DEGRADATION_PER_WORD = 0.06;
            const LEVEL_2_AUDIO_DEGRADATION_MAX = 1;
            const LEVEL_2_ROUNDS = DEFAULT_LEVEL_2_ROUNDS;
            const levelCatalog = createLevelCatalog({
                parseTargetPlan,
                level1WordCount: LEVEL_1_WORD_COUNT,
                level2Rounds: LEVEL_2_ROUNDS,
            });
            const { levels } = levelCatalog;
            let currentLevel = 1;
            let currentWordIndex = 0;
            let totalWordsPerLevel = LEVEL_1_WORD_COUNT;
            const completedPhrasesFromLevel1 = [];
            let levelTransitionActive = false;
            let sequenceFailed = false;
            let failReason = "timeout";
            let deadline = null;
            let timerInterval = null;
            let livesLeft = 3;
            let retriesLeft = 2;
            let wordCaughtThisBeat = false;
            let gateOpenedAt = 0;
            let refillAnimationUntil = 0;
            let gameOverContinuing = false;
            let gameOverContinueTimer = null;
            let wallEchoFiredThisBeat = false;
            let onboardingStep = 1;
            let gameStarted = false;
            let activeRecognition = null;
            const recognitionState = {
                starting: false,
                listening: false,
            };
            let onboardingVoiceBlocked = false;
            let lastGameOverFireFrame = -1;
            let lastKeygenHitAt = 0;
            const keygenCharacter = createKeygenCharacter();

            const AudioManager = createMusicManager({
                assetBaseUrl: "assets/audio",
                level2AudioDegradationStart: LEVEL_2_AUDIO_DEGRADATION_START,
                level2AudioDegradationPerWord: LEVEL_2_AUDIO_DEGRADATION_PER_WORD,
                level2AudioDegradationMax: LEVEL_2_AUDIO_DEGRADATION_MAX,
            });

            const startMainTheme = AudioManager.startMainTheme;
            const stopMainTheme = AudioManager.stopMainTheme;
            const playLevelFailedSound = AudioManager.playLevelFailedSound;
            const playRespawnSound = AudioManager.playRespawnSound;
            const playWallPassSound = AudioManager.playWallPassSound;
            const updateMusicDegradation = AudioManager.updateMusicDegradation;
            const updateLevel2MusicDegradation =
                AudioManager.updateLevel2MusicDegradation;
            const levelProgressionEffects = createLevelProgressionEffects({
                getCurrentLevel: () => currentLevel,
                updateMusicDegradation,
                updateLevel2MusicDegradation,
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
                },
                onIdleFrame(timestamp) {
                    updateAsciiWaveformBackground(0.1, timestamp);
                    updateGameOverWaveform(0.26, timestamp);
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

            function showOnboardingStep(step) {
                onboardingStep = step;
                showOnboardingStepView({
                    refs,
                    step,
                    speechRecognitionSupported: Boolean(SpeechRecognition),
                });
            }

            function goToInstructions() {
                showOnboardingStep(2);
                startOnboardingVoiceRecognition();
            }

            function hideOnboarding() {
                hideOnboardingView(refs);
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

            function parseTargetPlan() {
                return parseTargetPlanFromText(readConfig(refs).wordPlan);
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
                const isUndersea = level.environment === "undersea-cable";
                document.body.classList.toggle(
                    "environment-undersea",
                    isUndersea,
                );

                if (isUndersea) {
                    startMemoryPhraseSystem(useMockMemories);
                } else {
                    stopMemoryPhraseSystem();
                }
            }

            function setActiveLevel(
                levelId,
                { showIntro = true, useMockMemories = false } = {},
            ) {
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
                wordCaughtThisBeat = activationState.wordCaughtThisBeat;
                gateOpenedAt = activationState.gateOpenedAt;
                wallEchoFiredThisBeat = activationState.wallEchoFiredThisBeat;
                livesLeft = activationState.livesLeft;
                retriesLeft = activationState.retriesLeft;
                refillAnimationUntil = activationState.refillAnimationUntil;
                caughtWords.clear();
                lastKeygenHitAt = activationState.lastKeygenHitAt;
                keygenCharacter.reset();
                levelProgressionEffects.reset(level.id);
                stopSequenceTimer();
                clearTranscript();
                applyLevelEnvironment(level, useMockMemories);
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
                levelIntroController.show(level);
            }

            function beginActiveLevelGameplay() {
                levelTransitionActive = false;
                renderSequenceStatus();

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
            }

            function transitionToNextLevel() {
                const nextLevel = getNextLevel(levels, currentLevel);

                if (!nextLevel) {
                    return false;
                }

                setActiveLevel(nextLevel.id, { showIntro: true });
                return true;
            }

            function triggerVoiceSignal(state = "speaking") {
                keygenCharacter.triggerVoiceSignal(state);
            }

            function triggerKeygenFail() {
                keygenCharacter.triggerFail();
            }

            function triggerKeygenCollisionFail() {
                keygenCharacter.triggerCollisionFail();
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
                return getPlayerBoundsFromMetrics(metrics, currentLevel);
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
                    getTargetWords(),
                    text,
                    textMatchesTarget,
                );

                if (result.changed) {
                    triggerVoiceSignal("success");
                    maybeTriggerTalkback("beat");
                }
            }

            function getSecondsLimit() {
                return readConfig(refs).seconds;
            }

            function getLivesLimit() {
                return readConfig(refs).lives;
            }

            function getRetriesLimit() {
                return readConfig(refs).retries;
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
                const state = createRuleStateSnapshot();
                resetSequenceRule(state, {
                    livesLimit: getLivesLimit(),
                    retriesLimit: getRetriesLimit(),
                });
                applyRuleState(state);
                deadline = null;
                gateOpenedAt = 0;
                refillAnimationUntil = 0;
                levelProgressionEffects.reset(currentLevel);

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
                sequenceFailed = true;
                failReason = reason || "timeout";
                deadline = null;
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
                stopSequenceTimer();

                if (transitionToNextLevel()) {
                    return;
                }

                renderSequenceStatus();
                renderWordList();
                renderGameOverScreen();
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
                    const state = createRuleStateSnapshot();
                    acceptContinuePhraseRule(state, {
                        livesLimit: getLivesLimit(),
                        retriesLimit: getRetriesLimit(),
                    });
                    applyRuleState(state);
                    gameOverContinueTimer = null;
                    gameOverContinuing = false;
                    gateOpenedAt = 0;
                    wallEchoFiredThisBeat = false;
                    triggerKeygenRespawn();
                    playRespawnSound();
                    renderGameOverScreen();

                    if (currentWordIndex < getTargetWords().length) {
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
                    playWallPassSound();

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
                    return;
                }

                deadline = Date.now() + getSecondsLimit() * 1000;
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
                levelProgressionEffects.syncMusicDegradationToLevel();
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
                renderRoadScene({
                    timeline,
                    doc: document,
                    word,
                    wallRow,
                    gateProgress,
                    metrics: getRoadMetrics(),
                    environment: getLevelConfig().environment,
                    currentLevel,
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

                const words = getTargetWords();
                const state = createRuleStateSnapshot();
                const result = consumeSequenceText(state, words, text, {
                    mode: modeInput.value,
                    findWordEnd,
                });
                applyRuleState(state);

                if (isBeatMode()) {
                    if (result.beatHit) {
                        gateOpenedAt = Date.now();
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
                getProgress: () => getTalkbackProgress(),
                getMicStream,
                getAudioContext,
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
                return readConfig(refs).talkbackPhrases;
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
                    gameStarted ||
                    onboardingStep !== 2
                ) {
                    return;
                }

                try {
                    recognitionState.starting = true;
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
                hideOnboarding();
                setActiveLevel(levelId, {
                    showIntro: true,
                    useMockMemories,
                });
                startMainThemeFromGameStart();

                try {
                    await startVisualizer();
                    startEchoSystem();
                    startTalkbackCaptureSystem();
                    if (!recognitionState.listening && !recognitionState.starting) {
                        recognitionState.starting = true;
                        speechService.start();
                    } else if (recognitionState.listening) {
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
                if (onboardingStep === 1) {
                    goToInstructions();
                    return;
                }

                startGame();
            }

            function jumpToLevel(levelId, useMockMemories = false) {
                if (!gameStarted) {
                    startGame({ levelId, useMockMemories });
                    return;
                }

                setActiveLevel(levelId, {
                    showIntro: true,
                    useMockMemories,
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
                if (gameStarted || onboardingStep !== 2) {
                    return;
                }

                console.log("[voice] START command triggered game start");
                startGameFromOnboarding();
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
                    shouldMockLevel2Memories: () =>
                        completedPhrasesFromLevel1.length === 0,
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

            devLevelButtons.style.display = DEV_MODE ? "flex" : "none";

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
            onboardingAction.focus();

            const handleRecognitionResult = createRecognitionResultHandler({
                transcriptState,
                isGameStarted: () => gameStarted,
                getOnboardingStep: () => onboardingStep,
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
                    getOnboardingStep: () => onboardingStep,
                    isOnboardingVoiceBlocked: () => onboardingVoiceBlocked,
                    setOnboardingVoiceBlocked(value) {
                        onboardingVoiceBlocked = value;
                    },
                    startOnboardingVoiceRecognition,
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
}
