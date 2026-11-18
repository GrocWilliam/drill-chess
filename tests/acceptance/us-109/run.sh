#!/usr/bin/env bash
# US-109 acceptance tests: the /endgames page and its nav link.
# - http.test.mjs: access, levels, counts, cards, progress, French (built app, support/server.mjs builds unless FORGE_PREBUILT).
# - browser.test.mjs: Chromium at CHROMIUM_PATH (card click, nav-endgames, layout at 375, 1024).
# The merged us-70 and us-89 tests are run too: they must still pass.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
status=0
node --test --test-concurrency=1 tests/acceptance/us-109/http.test.mjs tests/acceptance/us-109/browser.test.mjs || status=1
bash tests/acceptance/us-70/run.sh || status=1
bash tests/acceptance/us-89/run.sh || status=1
exit $status
