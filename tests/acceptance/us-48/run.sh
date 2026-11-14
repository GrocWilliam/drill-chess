#!/usr/bin/env bash
# US-48 acceptance tests: Stockfish analysis of the demo game in the browser.
# - engine.test.ts: the pure helpers parseInfo and toWhite of src/lib/chess/engine.ts (Vitest).
# - browser.test.mjs: /games/demo in Chromium against the built app started by support/server.mjs with
#   PUBLIC_ENGINE_DEPTH=6 (builds once unless FORGE_PREBUILT is set, free port in 10000-32767, waits for /health).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
npx vitest run --config tests/acceptance/us-48/vitest.config.mjs || status=1
node --test --test-concurrency=1 tests/acceptance/us-48/browser.test.mjs || status=1
exit $status
