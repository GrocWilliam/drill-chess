#!/usr/bin/env bash
# US-67 acceptance tests: the `openings` block of getStats and GET /api/stats?openingsColour=.
# - stats.test.ts: getStats on rows inserted directly into the process `db` (PGlite memory://).
# - http.test.mjs: GET /api/stats against the built app with the fake chess.com and Lichess.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
npx vitest run --config tests/acceptance/us-67/vitest.config.mjs || status=1
node --test --test-concurrency=1 tests/acceptance/us-67/http.test.mjs || status=1
exit $status
