#!/usr/bin/env bash
# US-93 acceptance tests: drilling the repertoire on the board at /openings/drill.
# - http.test.mjs: the server-rendered page against the built app (access, drill-none, its link, French).
# - browser.test.mjs: Chromium at CHROMIUM_PATH (automatic moves, right and wrong moves, reviews sent, next line,
#   French feedback, layout at 375 and 1024px).
# Card ids come from GET /api/openings/drill; cards are made not due through the review endpoint (due tomorrow).
# Builds once (support/server.mjs) unless FORGE_PREBUILT is set.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-93/http.test.mjs tests/acceptance/us-93/browser.test.mjs
