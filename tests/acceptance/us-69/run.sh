#!/usr/bin/env bash
# US-69 acceptance tests: the `mistakes` block of the stats and the 1-second budget of getStats.
# - mistakes.test.ts: getStats through the module's function, users, games and `analyses` rows inserted directly into
#   the process `db` on PGlite memory:// (Vitest; acceptance Vitest has no `$lib` alias).
# - timing.test.ts: 5,000 games + 1,000 analyses for one user, getStats timed after a warm-up call (< 1000 ms).
# - http.test.mjs: GET /api/stats after POST /api/games/[id]/analysis, against the built app wired to the fake
#   chess.com of tests/acceptance/support/fakes/ (support/server.mjs builds once unless FORGE_PREBUILT is set,
#   free port, /health).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
npx vitest run --config tests/acceptance/us-69/vitest.config.mjs || status=1
node --test --test-concurrency=1 tests/acceptance/us-69/http.test.mjs || status=1
exit $status
