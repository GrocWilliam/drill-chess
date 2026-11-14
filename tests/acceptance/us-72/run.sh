#!/usr/bin/env bash
# US-72 acceptance tests: the /stats rating block (series picker, SVG line chart, summary).
# - http.test.mjs: HTTP against the built app wired to the fake chess.com and Lichess of tests/acceptance/support/fakes/
#   (new fake players rating_rook, rating_bishop, rating_pawn); support/server.mjs builds once unless FORGE_PREBUILT is set.
# - browser.test.mjs: Chromium at CHROMIUM_PATH, series picker without JavaScript, chart at 375×812 and 1024×768.
# "No series at all" is not tested: a user without rated game has no games, so /stats shows its empty state.
set -euo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-72/http.test.mjs tests/acceptance/us-72/browser.test.mjs
