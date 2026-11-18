#!/usr/bin/env bash
# US-94 acceptance tests: the drill summary at /openings/drill (browser, Chromium at CHROMIUM_PATH).
# Criteria: 20 cards end the drill (summary right 20, next due today, one card still due); nothing due ends it
# (right/wrong, tomorrow's date, progress 2/20); back/again links and drill-none again; colour=both plays each
# line in its own colour; French labels and date; 375px layout. Builds once unless FORGE_PREBUILT is set.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-94/browser.test.mjs
