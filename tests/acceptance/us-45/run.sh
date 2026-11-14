#!/usr/bin/env bash
# US-45 acceptance tests: storing a game's analysis.
# - http.test.mjs: POST /api/games/:id/analysis against the built app wired to the fake chess.com of
#   tests/acceptance/support/fakes/ (support/server.mjs builds once unless FORGE_PREBUILT is set, free port, /health).
# - get-analysis.test.ts: getAnalysis after a replacing save, through the review module on PGlite memory:// (Vitest).
# - repository.test.mjs: `make test` in a fresh checkout, with src/lib/server/review/index.test.ts.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
node --test --test-concurrency=1 tests/acceptance/us-45/http.test.mjs || status=1
npx vitest run --config tests/acceptance/us-45/vitest.config.mjs || status=1
node --test --test-concurrency=1 tests/acceptance/us-45/repository.test.mjs || status=1
exit $status
