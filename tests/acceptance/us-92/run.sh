#!/usr/bin/env bash
# US-92 acceptance tests: drill lines served by GET /api/openings/drill.
# - http.test.mjs: the endpoint against the built app (builds once unless FORGE_PREBUILT is set). The app runs on a
#   disk PGlite directory and is restarted once so the test can read the card ids it reviews to make cards not due
#   (dates are set only through the review endpoint: a reviewed card is due tomorrow).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-92/http.test.mjs
