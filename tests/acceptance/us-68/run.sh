#!/usr/bin/env bash
# US-68 acceptance tests: the rating block of getStats, pickSeries, and GET /api/stats.
# - rating.test.ts: getStats and pickSeries through the module's functions (Vitest, PGlite memory://, rows inserted directly).
# - http.test.mjs: GET /api/stats against the built app wired to the fake sites (builds unless FORGE_PREBUILT is set).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
npx vitest run --config tests/acceptance/us-68/vitest.config.mjs || status=1
node --test --test-concurrency=1 tests/acceptance/us-68/http.test.mjs || status=1
exit $status
