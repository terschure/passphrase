// Browser-only source for the game script. The canonical content lives in
// game-script.md at the repo root; a dev override may be saved to localStorage
// for playtesting and takes precedence until reset. Kept out of the pure module
// tests — everything here touches fetch / localStorage.

const STORAGE_KEY = "passphrase:gameScript";
const SCRIPT_URL = "./game-script.md";

// Minimal valid fallback used only when game-script.md cannot be fetched
// (e.g. opened via file:// instead of a local server). It is intentionally NOT
// a copy of the real content — the file is the single source of truth.
const FALLBACK_SCRIPT = `# Level 1
subtitle: OFFLINE
environment: border-fence

## Round 1
Run this game from a local server`;

export async function fetchFileScript(fetchImpl = fetch) {
    const response = await fetchImpl(SCRIPT_URL, { cache: "no-store" });

    if (!response.ok) {
        throw new Error(`game-script.md ${response.status}`);
    }

    return await response.text();
}

export function readScriptOverride(storage = safeStorage()) {
    try {
        return storage ? storage.getItem(STORAGE_KEY) : null;
    } catch (error) {
        return null;
    }
}

export function saveScriptOverride(text, storage = safeStorage()) {
    try {
        storage?.setItem(STORAGE_KEY, text);
    } catch (error) {
        /* ignore quota / privacy-mode errors */
    }
}

export function clearScriptOverride(storage = safeStorage()) {
    try {
        storage?.removeItem(STORAGE_KEY);
    } catch (error) {
        /* ignore */
    }
}

export function hasScriptOverride(storage = safeStorage()) {
    return readScriptOverride(storage) != null;
}

// Resolve the script to boot with: a saved override wins, otherwise the file,
// otherwise the offline fallback. Returns { script, source }.
export async function loadInitialScript({ fetchImpl, storage } = {}) {
    const override = readScriptOverride(storage);

    if (override != null) {
        return { script: override, source: "override" };
    }

    try {
        return { script: await fetchFileScript(fetchImpl), source: "file" };
    } catch (error) {
        console.error(
            "[game-script] Could not load game-script.md — run the game from a local server (python3 -m http.server).",
            error,
        );
        return { script: FALLBACK_SCRIPT, source: "fallback" };
    }
}

function safeStorage() {
    try {
        return typeof localStorage === "undefined" ? null : localStorage;
    } catch (error) {
        return null;
    }
}
