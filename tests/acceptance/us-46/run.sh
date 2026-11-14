#!/usr/bin/env bash
# US-46 acceptance tests: the Stockfish copy script (fresh checkout + npm ci), the engine files served, the public
# /games/demo page (HTTP, noscript), the landing-demo link, and the chessground board in Chromium (free play, typed
# moves, promotion, French, no third party). The server is started by support/server.mjs (builds once unless
# FORGE_PREBUILT is set, free port in 10000-32767, waits for /health).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-46/repository.test.mjs tests/acceptance/us-46/http.test.mjs \
  tests/acceptance/us-46/browser.test.mjs
