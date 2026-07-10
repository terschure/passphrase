# Repository Guidelines

## Project Structure & Module Organization

Passphrase is a dependency-free static browser game built with plain ES modules. The canonical app entry is `index.html`, which loads `src/main.js`. New source work belongs under `src/`; archived standalone prototypes live in `OLD/` for reference only.

- `src/app/` coordinates game flow and binds controls.
- `src/ui/` renders HUD, settings, onboarding, transcript, and game-over views.
- `src/content/` parses `game-script.md` and resolves level/environment data.
- `src/game/`, `src/matching/`, and `src/speech/` contain core rules, target matching, and Web Speech API lifecycle code.
- `src/renderers/ascii/`, `src/audio/`, `src/effects/`, `src/echo/`, and `src/talkback/` own focused runtime subsystems.
- `styles/main.css` contains app styling, `assets/audio/` contains music and SFX, and `tests/run-tests.mjs` contains dependency-free module tests.

## Build, Test, and Development Commands

There is no build step, bundler, or package manager install.

```sh
python3 -m http.server 5173
```

Serves the repository at `http://127.0.0.1:5173/`. Use Chrome or Edge; speech recognition and microphone features need browser permission and a secure context such as localhost.

```sh
node tests/run-tests.mjs
```

Runs the module tests in Node without launching a browser.

## Coding Style & Naming Conventions

Use modern JavaScript modules with explicit imports/exports. Keep indentation at four spaces to match the existing source. Prefer small, focused modules with plain-object inputs and narrow callbacks. Browser orchestration belongs in `src/app/passphraseApp.js`; pure game logic should stay browser-free and testable.

Use camelCase for functions and variables, PascalCase only for constructors/classes, and descriptive filenames that match the subsystem pattern already in `src/`.

## Testing Guidelines

Add or update tests in `tests/run-tests.mjs` when changing pure rules, parsing, matching, render calculations, audio utilities, or runtime policy. Name tests by expected behavior, not implementation detail. Browser-only microphone, speech, and visual behavior still require manual verification in Chrome or Edge.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, descriptive messages such as `mic initialisation modal` and `fix for music on ios`. Keep commits focused on one change.

Pull requests should summarize behavior changes, list test/manual verification performed, and include screenshots or screen recordings for visible UI/gameplay changes. Note any changes to `game-script.md`, audio assets, or browser permission flows.
