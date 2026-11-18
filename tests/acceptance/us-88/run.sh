#!/usr/bin/env bash
# US-88 acceptance tests: the repertoire editor at /openings/<colour>.
# - http.test.mjs: server-rendered page against the built app (access, start position, ?line=, listed moves, French).
# - browser.test.mjs: Chromium at CHROMIUM_PATH (typing moves, errors, reload, path links, layout at 375 and 1024px).
# Builds once (support/server.mjs) unless FORGE_PREBUILT is set.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-88/http.test.mjs tests/acceptance/us-88/browser.test.mjs
