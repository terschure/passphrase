import { initPassphraseApp } from "./app/passphraseApp.js";
import { loadInitialScript } from "./content/gameScriptSource.js";

// Load the canonical game script (game-script.md, or a saved dev override) into
// the settings textarea before the app reads it, then boot the game.
const { script } = await loadInitialScript();
const wordsInput = document.querySelector("#words");

if (wordsInput) {
    wordsInput.value = script;
}

initPassphraseApp();
