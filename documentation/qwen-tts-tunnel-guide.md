# Qwen TTS tunnel quick start

Passphrase is a static site. The browser calls a local FastAPI service through
an HTTPS Cloudflare tunnel:

```text
passphrase.fun -> https://<random>.trycloudflare.com -> 127.0.0.1:8000
                                                    -> Qwen3-TTS on the Mac
```

The backend lives in the sibling `tts-test-bench` repository. Passphrase uses:

- `GET /api/health`
- `POST /api/refs` to upload a recorded voice reference
- `POST /api/generate` with model `qwen3-tts-0.6b-base`
- the returned `audio_url` to play generated speech

## One-time setup

From the Passphrase repository:

```sh
brew install cloudflared
cd ../tts-test-bench
./scripts/setup-backend.sh
```

This requires an Apple Silicon Mac and the prerequisites listed in
`../tts-test-bench/docs/SETUP.md`.

## Start a session

Keep both commands running in separate terminals.

**Terminal 1: start Qwen and the API**

```sh
cd ../tts-test-bench

TTSBENCH_DEFAULT_MODEL=qwen3-tts-0.6b-base \
TTSBENCH_PRELOAD_MODELS='["qwen3-tts-0.6b-base"]' \
backend/.venv/bin/python -m uvicorn backend.app:app \
    --host 127.0.0.1 --port 8000
```

Use one worker only. On the first run, wait for the model download and warmup
to finish.

**Terminal 2: expose the API over HTTPS**

```sh
cloudflared tunnel --url http://127.0.0.1:8000
```

Copy the printed URL ending in `.trycloudflare.com`, then verify it:

```sh
curl -s https://YOUR-TUNNEL.trycloudflare.com/api/health
```

Continue when it returns JSON with `"ready": true` and includes
`qwen3-tts-0.6b-base` in `loaded_models`.

## Connect Passphrase

1. Open `https://passphrase.fun`; the deployed app selects the configured
   tunnel automatically.
2. Keep **generated talk-back** enabled and confirm the talk-back panel changes
   from `checking` to `ready`.
3. Play normally. The game collects at least five seconds of speech, uploads a
   reference, requests generated phrases, and plays the returned WAV files.

For local Passphrase development, use `http://127.0.0.1:8000` directly; no
tunnel is needed.

## What the old implementation did

Commit `91fbe47` detected the old GitHub Pages URL and replaced the local API
origin with a hardcoded Cloudflare Quick Tunnel URL. Quick Tunnel hostnames are
temporary, so that hostname was only valid while its tunnel process was alive.
The modular app now performs the same origin-based selection in
`src/talkback/endpoint.js`, while preserving the local endpoint for local use.

## Gaps to close

1. **Public exposure:** the backend has no authentication or rate limiting. A
   Quick Tunnel exposes generation, stored references, and generated audio to
   anyone who knows the URL. Use this only for supervised testing.
2. **Unstable endpoint:** the Quick Tunnel hostname changes on restart. The
   deployed endpoint must then be changed in `src/talkback/endpoint.js` and
   redeployed. A named Cloudflare Tunnel at a stable hostname such as
   `tts.passphrase.fun` is the durable fix.
3. **No launcher:** backend startup, readiness checks, tunnel startup, and URL
   configuration are still manual and spread across two repositories.
4. **Voice-data retention:** uploaded references and generations remain under
   `tts-test-bench/samples/`. There is no automatic expiry or player-facing
   deletion/consent flow.
5. **Availability:** talk-back works only while the Mac, model server, and
   tunnel are running. The core game continues when the endpoint is offline.
6. **Backend docs drift:** some `tts-test-bench` examples use `/health` and
   `/models`; the implemented routes are `/api/health` and `/api/models`.

Before treating this as a public production service, add a stable named
tunnel, an abuse-control/authentication design suitable for a static public
client, request limits, and automatic reference/generation cleanup.
