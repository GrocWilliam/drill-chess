#!/usr/bin/env bash
# US-112 acceptance tests: playing /endgames/<id> against tablebase replies and recording each attempt.
# browser.test.mjs: Chromium at CHROMIUM_PATH, the built app (support/server.mjs builds unless FORGE_PREBUILT) with
# TABLEBASE_URL pointing at the fake tablebase (support/fakes/server.mjs, scripted lines in support/fakes/tablebase.mjs).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
exec node --test --test-concurrency=1 tests/acceptance/us-112/browser.test.mjs
