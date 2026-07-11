export function createLevelProgressionEffects({
    getCurrentLevel,
    syncLevel2EnemyCount,
    updateKeygenDistortion,
}) {
    let level2CompletedWordCount = 0;
    let lastSyncedLevel = 0;

    return {
        getLevel2CompletedWordCount() {
            return level2CompletedWordCount;
        },
        syncLevelEffects() {
            const level = getCurrentLevel();

            if (level === lastSyncedLevel) {
                return;
            }

            lastSyncedLevel = level;
            updateKeygenDistortion(level);
        },
        reset() {
            level2CompletedWordCount = 0;
            syncLevel2EnemyCount();
        },
        registerSuccessfulPhrase() {
            if (getCurrentLevel() !== 2) {
                return false;
            }

            level2CompletedWordCount += 1;
            syncLevel2EnemyCount();
            return true;
        },
    };
}
