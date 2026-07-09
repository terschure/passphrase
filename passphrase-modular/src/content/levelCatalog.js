export function createLevelCatalog({
    parseTargetPlan,
    level1WordCount,
    level2Rounds,
}) {
    const level2Phrases = level2Rounds.flatMap((round) => round.phrases);
    const levels = [
        {
            id: 1,
            name: "Level 1",
            subtitle: "BORDER CHECKPOINT",
            environment: "border-fence",
            get phrases() {
                return parseTargetPlan()
                    .slice(0, level1WordCount)
                    .map((entry) => entry.text);
            },
        },
        {
            id: 2,
            name: "Level 2",
            subtitle: "UNDERSEA CABLE",
            environment: "undersea-cable",
            phrases: level2Phrases,
        },
    ];

    function getLevelConfig(levelId = 1) {
        return levels.find((level) => level.id === levelId) || levels[0];
    }

    function getLevelEntries(levelId = 1) {
        const level = getLevelConfig(levelId);

        if (level.id === 1) {
            return parseTargetPlan()
                .slice(0, level1WordCount)
                .map((entry) => ({
                    ...entry,
                    levelTitle: level.name,
                    levelIndex: 0,
                }));
        }

        if (level.id === 2) {
            return level2Rounds.flatMap((round, roundIndex) =>
                round.phrases.map((text) => ({
                    text,
                    levelTitle: level.name,
                    sequenceTitle: round.name,
                    levelIndex: level.id - 1,
                    sequenceIndex: roundIndex,
                })),
            );
        }

        return level.phrases.map((text, index) => ({
            text,
            levelTitle: level.name,
            sequenceTitle: "Signal descent",
            levelIndex: level.id - 1,
            sequenceIndex: 0,
        }));
    }

    return {
        levels,
        getLevelConfig,
        getLevelEntries,
    };
}
