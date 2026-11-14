#!/usr/bin/env bash
# US-71 acceptance tests: the `stats-openings` block of /stats (colour toggle, links to /games).
# - http.test.mjs: HTTP against the built app wired to the fake chess.com (alpha_pawn, opening_owl) and Lichess
#   (beta_rook) of tests/acceptance/support/fakes/; rows compared with GET /api/stats, link parameters as a set.
# - browser.test.mjs: Chromium at CHROMIUM_PATH, the toggle without JavaScript, layout at 375×812 and 1024×768.
set -euo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-71/http.test.mjs tests/acceptance/us-71/browser.test.mjs
