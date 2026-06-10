# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Prototypes for a voice-driven "pass phrase" game built on the Web Speech API (`SpeechRecognition`). Each HTML file is a fully self-contained prototype — inline CSS and JavaScript, no build system, no dependencies, no package.json, no tests.

## Running

Open any HTML file directly in Chrome or Edge (the only browsers with `webkitSpeechRecognition` support). Speech recognition and the microphone visualizer require mic permission; if testing over a server rather than `file://`, use `python3 -m http.server` — the Web Speech API needs a secure context (localhost or https).

There is no lint, build, or test command. Verifying changes means opening the page in a browser and speaking into the mic.

## The three prototypes

- **`index.html`** — "Live Voice Transcript": the core word-catching engine as a debug/testing UI. Two modes: *catch* (check off any target word heard) and *sequence* (words must be spoken in order, each within a configurable deadline, rendered as an ASCII timeline). Also has a canvas mic-level visualizer and a toggle between unstable interim transcripts and final-only results.
- **`road_talk.html`** — "Road Talk": a standalone arcade game. An ASCII road scrolls toward the car; each wall carries a hard-to-pronounce English word (fixed `WORDS` list with phonetic hints and accepted alternates). Saying the word correctly opens the wall; a wrong attempt or timeout bounces the car back. Pressing `D` toggles a debug panel showing what the recognizer heard.
- **`road_configurable.html`** — the merge of the two: index.html's configurable sequence/catch engine (user-supplied word list, settings panel) driving road_talk's full-screen ASCII road rendering. This is the most recent prototype.

## Architecture notes

- **Two recognition strategies exist.** index.html and road_configurable.html use one long-lived continuous recognizer (`continuous: true, interimResults: true`) and re-scan the accumulated transcript. road_talk.html instead restarts a short one-shot recognizer in a loop (`continuous: false, maxAlternatives: 8`) and judges each utterance independently.
- **Word matching differs accordingly.** The configurable prototypes match with a word-boundary regex (`textHasWord`/`catchWords`) against the chosen transcript source. road_talk.html has a deliberately forgiving phonetic pipeline in `isMatch()`: alternate spellings list, Soundex, a `phonetize()` consonant-skeleton normalizer, and edit-distance thresholds — relevant if pronunciation tolerance needs tuning.
- **index.html and road_configurable.html share most of their JS** (same function names: `processSequenceText`, `renderSequenceStatus`, `startVisualizer`, etc.). A fix to that shared logic usually applies to both files; they are kept in sync by hand.
- Sequence state lives in a handful of module-level variables (`sequenceIndex`, `sequenceFailed`, `deadline`, `caughtWords`); `resetSequence()` is the single reset path and is invoked whenever settings change.
