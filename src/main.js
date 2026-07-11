import { initPassphraseApp } from "./app/passphraseApp.js";
import { loadInitialScript } from "./content/gameScriptSource.js";
import { getDefaultTalkbackEndpoint } from "./talkback/endpoint.js";

// Load the canonical game script (game-script.md, or a saved dev override) into
// the settings textarea before the app reads it, then boot the game.
const { script } = await loadInitialScript();
const wordsInput = document.querySelector("#words");
const talkbackEndpointInput = document.querySelector("#talkback-endpoint-url");

if (wordsInput) {
    wordsInput.value = script;
}

if (talkbackEndpointInput) {
    talkbackEndpointInput.value = getDefaultTalkbackEndpoint(window.location);
}

initPassphraseApp();
