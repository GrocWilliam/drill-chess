#!/usr/bin/env bash
# US-51 acceptance tests: the games-analysed badge on /games.
# - http.test.mjs and paging.test.mjs: HTTP against the built app wired to the fake chess.com and Lichess of
#   tests/acceptance/support/fakes/ (support/server.mjs builds once unless FORGE_PREBUILT is set, free port, /health).
# - browser.test.mjs: the badge in its row at 375×812 and 1024×768 (Chromium at CHROMIUM_PATH).
set -euo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-51/http.test.mjs tests/acceptance/us-51/paging.test.mjs tests/acceptance/us-51/browser.test.mjs
