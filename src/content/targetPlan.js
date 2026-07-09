const METADATA_KEYS = new Set(["subtitle", "environment"]);
const DEFAULT_ENVIRONMENT = "border-fence";
const DEFAULT_SEQUENCE_TITLE = "Main sequence";
const TALKBACK_SECTION = /^talkback$/i;

// Parse the game script markdown into structured levels + a flat entry list.
//
// Grammar:
//   "# name"            -> starts a level (name is the level title)
//   "subtitle: value"   -> level metadata, only in the header zone
//   "environment: value"-> level metadata, only in the header zone
//   "## name"           -> starts a round/sequence within the current level
//   "## Talkback"       -> starts the level's random talk-back pool (not a round)
//   "~ text"            -> a talk-back line spoken by the system:
//                            inside a round  -> a positional cue anchored after
//                                               the phrase directly above it
//                            inside Talkback -> a random-pool phrase
//   ">" prefixed lines  -> comments, ignored
//   any other line      -> a phrase in the current round (or a random talk-back
//                          phrase when inside the Talkback section)
//
// The header zone is the span after a "# name" line and before the first
// round/phrase; only there are "key: value" lines treated as metadata.
export function parseGameScript(source) {
    const levels = [];
    let level = null;
    let round = null;
    let inHeaderZone = false;
    let inTalkback = false;

    function startLevel(name) {
        level = {
            id: levels.length + 1,
            name,
            subtitle: "",
            environment: DEFAULT_ENVIRONMENT,
            rounds: [],
            entries: [],
            talkbackRandom: [],
            talkbackCues: [],
        };
        levels.push(level);
        round = null;
        inHeaderZone = true;
        inTalkback = false;
    }

    function startRound(name) {
        if (!level) {
            startLevel("Level 1");
        }

        round = { name, sequenceIndex: level.rounds.length, phrases: [] };
        level.rounds.push(round);
        inHeaderZone = false;
        inTalkback = false;
    }

    function pushPhrase(text) {
        if (!level) {
            startLevel("Level 1");
        }

        if (!round) {
            startRound(DEFAULT_SEQUENCE_TITLE);
        }

        round.phrases.push(text);
        level.entries.push({
            text,
            levelTitle: level.name,
            sequenceTitle: round.name,
            levelIndex: level.id - 1,
            sequenceIndex: round.sequenceIndex,
        });
    }

    for (const rawLine of String(source || "").split("\n")) {
        const line = rawLine.trim();

        if (!line || line.startsWith(">")) {
            continue;
        }

        const sequenceMatch = line.match(/^##\s*(.+)$/);
        if (sequenceMatch) {
            const name = sequenceMatch[1].trim();

            if (!level) {
                startLevel("Level 1");
            }

            if (TALKBACK_SECTION.test(name)) {
                round = null;
                inHeaderZone = false;
                inTalkback = true;
            } else {
                startRound(name);
            }

            continue;
        }

        const levelMatch = line.match(/^#\s*(.+)$/);
        if (levelMatch) {
            startLevel(levelMatch[1].trim());
            continue;
        }

        // "~" — a line the system speaks back (talk-back)
        if (line.startsWith("~")) {
            const text = line.slice(1).trim();

            if (!level) {
                startLevel("Level 1");
            }

            if (!text) {
                continue;
            }

            if (inTalkback) {
                level.talkbackRandom.push(text);
            } else {
                inHeaderZone = false;
                level.talkbackCues.push({
                    afterIndex: level.entries.length - 1,
                    text,
                });
            }

            continue;
        }

        if (level && inHeaderZone && !inTalkback) {
            const metaMatch = line.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
            if (metaMatch && METADATA_KEYS.has(metaMatch[1].toLowerCase())) {
                level[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
                continue;
            }
        }

        if (inTalkback) {
            if (!level) {
                startLevel("Level 1");
            }

            level.talkbackRandom.push(line);
            continue;
        }

        pushPhrase(line);
    }

    return {
        levels,
        entries: levels.flatMap((entry) => entry.entries),
    };
}

// Back-compat helper: the flat entry list only.
export function parseTargetPlan(source) {
    return parseGameScript(source).entries;
}
