#!/usr/bin/env bash
# US-66 acceptance tests: the stats module and GET /api/stats.
# - stats.test.ts: parseStatsFilters, scorePercent and getStats through the module's functions, users and games
#   inserted directly into the process `db` on PGlite memory:// (Vitest; acceptance Vitest has no `$lib` alias).
# - http.test.mjs: GET /api/stats against the built app wired to the fake chess.com and Lichess of
#   tests/acceptance/support/fakes/ (support/server.mjs builds once unless FORGE_PREBUILT is set, free port, /health).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
npx vitest run --config tests/acceptance/us-66/vitest.config.mjs || status=1
node --test --test-concurrency=1 tests/acceptance/us-66/http.test.mjs || status=1
exit $status
