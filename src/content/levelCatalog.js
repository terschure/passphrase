// The level catalog is a thin query layer over the parsed game script. It holds
// no content of its own: `getScriptLevels()` returns the current parsed levels
// (each with id/name/subtitle/environment/rounds/entries), so edits to the
// script — including in the dev override — take effect immediately.
export function createLevelCatalog({ getScriptLevels }) {
    function getLevels() {
        return getScriptLevels();
    }

    function getLevelConfig(levelId = 1) {
        const levels = getScriptLevels();
        return (
            levels.find((level) => level.id === levelId) ||
            levels[0] || {
                id: 1,
                name: "Level 1",
                subtitle: "",
                environment: "border-fence",
                rounds: [],
                entries: [],
            }
        );
    }

    function getLevelEntries(levelId = 1) {
        return getLevelConfig(levelId).entries;
    }

    return {
        getLevels,
        getLevelConfig,
        getLevelEntries,
    };
}
