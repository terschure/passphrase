export const DEFAULT_MEMORY_PHRASE_ENEMY_CONFIG = {
    baseEnemyCount: 6,
    enemiesPerWord: 1,
    maxEnemyCount: 28,
    sideEnemyChance: 0.45,
    matrixSymbolChance: 0.35,
    sideSpeedMin: 1,
    sideSpeedMax: 3,
    enemyMinScale: 1.4,
    enemyMaxScale: 2.6,
    enemySpeedMin: 0.6,
    enemySpeedMax: 2.2,
    enemyGlitchChance: 0.08,
    enemyDirectionChangeChance: 0.015,
    enemyBurstChance: 0.006,
    enemyOpacityMin: 0.35,
    enemyOpacityMax: 0.85,
    enemyOverlapFrequency: 0.68,
    enemyZIndex: 2,
    matrixSymbols: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@%/\\|_=+~^",
    mockPhrases: [
        "I'll be back",
        "Access granted",
        "Open the gate",
        "Trust the signal",
        "Follow the packet",
        "Break the wall",
        "Voice confirmed",
        "System awake",
    ],
    level3Phrases: [
        "VOICE COPIED",
        "YOUR SAMPLE IS ACTIVE",
        "SYNTHETIC ID ONLINE",
        "ACCESS OWNER: SYSTEM",
        "CLAIM DENIED",
        "RECORDING STORED",
        "TRAINING DATA ACCEPTED",
        "VOICEPRINT LOCKED",
        "CLONE ACTIVE",
        "IDENTITY SPLIT",
        "OWNERSHIP REVOKED",
        "SYNTHETIC ID ACTIVE",
        "ACCESS DENIED",
    ],
};

export function createLevel2MatrixFragment(
    length = 12,
    symbols = DEFAULT_MEMORY_PHRASE_ENEMY_CONFIG.matrixSymbols,
) {
    let output = "";

    for (let index = 0; index < length; index += 1) {
        output += symbols[Math.floor(Math.random() * symbols.length)];
    }

    return output;
}

export function getMemoryPhraseEnemyTargetCount(
    completedWordCount,
    config = DEFAULT_MEMORY_PHRASE_ENEMY_CONFIG,
) {
    return Math.min(
        config.maxEnemyCount,
        config.baseEnemyCount + completedWordCount * config.enemiesPerWord,
    );
}

export function createMemoryPhraseEnemySystem({
    layer,
    getCurrentLevel,
    getCompletedWordCount,
    getPhraseSource,
    config = DEFAULT_MEMORY_PHRASE_ENEMY_CONFIG,
    activeLevelIds = [3],
    win = window,
    doc = document,
}) {
    let frame = null;
    let lastFrame = 0;
    let enemies = [];
    let phraseSource = [];

    function stop() {
        if (frame) {
            win.cancelAnimationFrame(frame);
            frame = null;
        }

        lastFrame = 0;
        enemies = [];
        phraseSource = [];
        layer.classList.remove("active");
        layer.replaceChildren();
    }

    function createEnemy(index) {
        if (!phraseSource.length) {
            return null;
        }

        const element = doc.createElement("span");
        const isSideEntry = Math.random() < config.sideEnemyChance;
        const isMatrix = Math.random() < config.matrixSymbolChance;
        const phrase = phraseSource[index % phraseSource.length];
        const coreText = isMatrix
            ? createLevel2MatrixFragment(
                  8 + Math.floor(Math.random() * 10),
                  config.matrixSymbols,
              )
            : phrase;
        const prefix = config.matrixSymbols[index % config.matrixSymbols.length];
        const suffix =
            config.matrixSymbols[(index * 3 + 7) % config.matrixSymbols.length];
        const enemySpeed =
            config.enemySpeedMin +
            Math.random() * (config.enemySpeedMax - config.enemySpeedMin);
        const sideSpeed =
            config.sideSpeedMin +
            Math.random() * (config.sideSpeedMax - config.sideSpeedMin);
        const fromLeft = Math.random() < 0.5;
        const angle = Math.random() * Math.PI * 2;
        const overlapsTarget = Math.random() < config.enemyOverlapFrequency;
        const scale =
            config.enemyMinScale +
            Math.random() * (config.enemyMaxScale - config.enemyMinScale);

        element.className = isMatrix
            ? "enemy-phrase enemy-phrase--matrix"
            : "enemy-phrase";
        element.textContent = prefix + " " + coreText + " " + suffix;
        layer.append(element);

        return {
            element,
            x: isSideEntry
                ? fromLeft
                    ? -380
                    : win.innerWidth + 80
                : Math.random() * win.innerWidth,
            y: overlapsTarget
                ? win.innerHeight * (0.2 + Math.random() * 0.48)
                : win.innerHeight * (0.08 + Math.random() * 0.78),
            vx: isSideEntry
                ? (fromLeft ? 1 : -1) * sideSpeed * 78
                : Math.cos(angle) * enemySpeed * 72,
            vy: isSideEntry
                ? (Math.random() - 0.5) * 32
                : Math.sin(angle) * enemySpeed * 54,
            speed: isSideEntry ? sideSpeed : enemySpeed,
            scale: isMatrix ? scale * 0.78 : scale,
            rotation: (Math.random() - 0.5) * 9,
            opacity:
                config.enemyOpacityMin +
                Math.random() * (config.enemyOpacityMax - config.enemyOpacityMin),
            phase: Math.random() * Math.PI * 2,
            glitchUntil: 0,
            burstUntil: 0,
            sideEntry: isSideEntry,
        };
    }

    function syncEnemyCount() {
        if (
            !activeLevelIds.includes(getCurrentLevel()) ||
            !layer.classList.contains("active")
        ) {
            return;
        }

        const targetCount = getMemoryPhraseEnemyTargetCount(
            getCompletedWordCount(),
            config,
        );

        while (enemies.length < targetCount) {
            const enemy = createEnemy(enemies.length);

            if (!enemy) {
                break;
            }

            enemies.push(enemy);
        }

        while (enemies.length > targetCount) {
            const enemy = enemies.pop();
            enemy?.element.remove();
        }
    }

    function update(timestamp) {
        if (!activeLevelIds.includes(getCurrentLevel())) {
            stop();
            return;
        }

        syncEnemyCount();
        const deltaSeconds = lastFrame
            ? Math.min(0.05, (timestamp - lastFrame) / 1000)
            : 0;
        lastFrame = timestamp;
        const frameScale = Math.max(0.25, deltaSeconds * 60);

        for (const [index, fragment] of enemies.entries()) {
            if (
                !fragment.sideEntry &&
                Math.random() < config.enemyDirectionChangeChance * frameScale
            ) {
                const angle = Math.random() * Math.PI * 2;
                fragment.vx = Math.cos(angle) * fragment.speed * 72;
                fragment.vy = Math.sin(angle) * fragment.speed * 54;
            }

            if (Math.random() < config.enemyGlitchChance * frameScale) {
                fragment.glitchUntil = timestamp + 90 + Math.random() * 130;
            }

            if (Math.random() < config.enemyBurstChance * frameScale) {
                fragment.burstUntil = timestamp + 180;
            }

            const burst = timestamp < fragment.burstUntil ? 2.8 : 1;
            fragment.x += fragment.vx * deltaSeconds * burst;
            fragment.y += fragment.vy * deltaSeconds * burst;

            const wrapMargin = 380;
            if (fragment.x > win.innerWidth + wrapMargin) {
                fragment.x = -wrapMargin;
            } else if (fragment.x < -wrapMargin) {
                fragment.x = win.innerWidth + wrapMargin;
            }

            if (fragment.y > win.innerHeight - 24) {
                fragment.y = 24;
                fragment.vy = -Math.abs(fragment.vy);
            } else if (fragment.y < 18) {
                fragment.y = win.innerHeight - 30;
                fragment.vy = Math.abs(fragment.vy);
            }

            const isGlitching = timestamp < fragment.glitchUntil;
            const wave = Math.sin(timestamp / 105 + fragment.phase);
            const glitchX = isGlitching ? (Math.random() - 0.5) * 34 : wave * 2;
            const glitchY = isGlitching ? (Math.random() - 0.5) * 18 : 0;
            const flicker = isGlitching ? (Math.random() - 0.5) * 0.28 : wave * 0.05;
            fragment.element.style.opacity = String(
                Math.min(
                    config.enemyOpacityMax,
                    Math.max(config.enemyOpacityMin, fragment.opacity + flicker),
                ),
            );
            fragment.element.style.transform =
                "translate3d(" +
                (fragment.x + glitchX) +
                "px, " +
                (fragment.y + glitchY) +
                "px, 0) scale(" +
                fragment.scale * (isGlitching ? 1.08 : 1) +
                ") rotate(" +
                (fragment.rotation + wave * 1.4) +
                "deg) skewX(" +
                (isGlitching ? wave * 8 : 0) +
                "deg)";
            fragment.element.style.filter =
                isGlitching && index % 2 === 0 ? "contrast(1.7)" : "none";
        }

        frame = win.requestAnimationFrame(update);
    }

    function start(useMockMemories = false) {
        stop();
        const currentLevel = getCurrentLevel();
        if (!activeLevelIds.includes(currentLevel)) {
            return;
        }

        const completedPhrases = getPhraseSource(currentLevel);
        phraseSource =
            currentLevel === 3
                ? config.level3Phrases
                : !useMockMemories && completedPhrases.length
                ? completedPhrases
                : config.mockPhrases;

        layer.style.zIndex = String(config.enemyZIndex);
        layer.classList.add("active");
        syncEnemyCount();
        frame = win.requestAnimationFrame(update);
    }

    return {
        start,
        stop,
        syncEnemyCount,
    };
}
