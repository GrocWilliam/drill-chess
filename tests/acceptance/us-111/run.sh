#!/usr/bin/env bash
# US-111 acceptance tests: the /endgames/[id] board page.
# - http.test.mjs: access, 404, the kq-k page (built app; support/server.mjs builds unless FORGE_PREBUILT).
# - browser.test.mjs: Chromium at CHROMIUM_PATH (orientation, moves, retry, other side, back link, French, layouts).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
exec node --test --test-concurrency=1 tests/acceptance/us-111/http.test.mjs tests/acceptance/us-111/browser.test.mjs
