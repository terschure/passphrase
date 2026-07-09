// Built-in visual presets a level can select via its "environment:" metadata.
//
// Each preset fully describes a level's look so that any level using it renders
// consistently, regardless of its position in the script:
//   - character:     which avatar the player is drawn as
//   - bodyClass:     the <body> class that themes the page background/waveform
//   - memoryEnemies: whether the Level 2 floating memory-phrase swarm runs
//
// To add a new theme, add an entry here and the matching CSS/renderer support.
export const ENVIRONMENTS = {
    "border-fence": {
        id: "border-fence",
        character: "passport",
        bodyClass: "environment-border-fence",
        memoryEnemies: false,
    },
    "undersea-cable": {
        id: "undersea-cable",
        character: "password-key",
        bodyClass: "environment-undersea",
        memoryEnemies: true,
    },
};

export const DEFAULT_ENVIRONMENT_ID = "border-fence";

// Resolve an environment name to its preset, falling back to the default look
// for unknown values so a typo in the script never breaks rendering.
export function resolveEnvironment(name) {
    return ENVIRONMENTS[name] || ENVIRONMENTS[DEFAULT_ENVIRONMENT_ID];
}

export const ENVIRONMENT_BODY_CLASSES = Object.values(ENVIRONMENTS).map(
    (preset) => preset.bodyClass,
);
