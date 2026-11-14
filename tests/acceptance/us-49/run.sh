#!/usr/bin/env bash
# US-49 acceptance tests: evaluation curve and board page layouts on /games/demo.
# browser.test.mjs runs in Chromium against the built app started by support/server.mjs
# (builds once unless FORGE_PREBUILT is set, free port in 10000-32767, waits for /health).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-49/browser.test.mjs
