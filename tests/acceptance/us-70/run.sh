#!/usr/bin/env bash
# US-70 acceptance tests: the /stats page (navigation, filters, colour and time-control blocks, empty state).
# - docs.test.mjs: docs/ui.md lists the new ids and components.
# - http.test.mjs, perf.test.mjs: HTTP against the built app wired to the fake chess.com and Lichess of
#   tests/acceptance/support/fakes/ (support/server.mjs builds once unless FORGE_PREBUILT is set, free port, /health).
# - browser.test.mjs: Chromium at CHROMIUM_PATH, nav bars, layout at 375×812 and 1024×768, filters without JavaScript.
set -euo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-70/docs.test.mjs tests/acceptance/us-70/http.test.mjs \
  tests/acceptance/us-70/browser.test.mjs tests/acceptance/us-70/perf.test.mjs
