export function createLevelProgressionEffects({
    getCurrentLevel,
    updateMusicDegradation,
    updateLevel2MusicDegradation,
    syncLevel2EnemyCount,
    updateKeygenDistortion,
}) {
    let level2CompletedWordCount = 0;
    let lastMusicDegradationLevel = 0;

    return {
        getLevel2CompletedWordCount() {
            return level2CompletedWordCount;
        },
        syncMusicDegradationToLevel() {
            const level = getCurrentLevel();

            if (level === lastMusicDegradationLevel) {
                return;
            }

            lastMusicDegradationLevel = level;
            if (level === 2) {
                updateLevel2MusicDegradation(level2CompletedWordCount);
            } else {
                updateMusicDegradation(1);
            }
            updateKeygenDistortion(level);
        },
        reset(levelId) {
            level2CompletedWordCount = 0;

            if (levelId === 2) {
                updateLevel2MusicDegradation(0);
            } else {
                updateMusicDegradation(1);
            }

            syncLevel2EnemyCount();
        },
        registerSuccessfulPhrase() {
            if (getCurrentLevel() !== 2) {
                return false;
            }

            level2CompletedWordCount += 1;
            syncLevel2EnemyCount();
            updateLevel2MusicDegradation(level2CompletedWordCount);
            return true;
        },
    };
}
