#!/usr/bin/env bash
# US-50 acceptance tests: review an imported game on /games/<id> (analyse in the browser, save, reload, re-analyse).
# http.test.mjs (no JavaScript, access) and browser.test.mjs (Chromium) run against the built app wired to the fake
# chess.com of support/fakes/ (made-up players `alpha_pawn` and `review_rook`), started by support/server.mjs
# (builds once unless FORGE_PREBUILT is set, free port in 10000-32767, waits for /health, PUBLIC_ENGINE_DEPTH=6).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-50/http.test.mjs tests/acceptance/us-50/browser.test.mjs
