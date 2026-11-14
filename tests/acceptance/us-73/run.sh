#!/usr/bin/env bash
# US-73 acceptance tests: the /stats mistakes-by-phase block.
# - http.test.mjs: HTTP against the built app wired to the fake chess.com and Lichess of tests/acceptance/support/fakes/
#   (support/server.mjs builds once unless FORGE_PREBUILT is set, free port, /health); analyses saved through the API.
# - browser.test.mjs: Chromium at CHROMIUM_PATH, layout at 375×812 and 1024×768.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-73/http.test.mjs tests/acceptance/us-73/browser.test.mjs
