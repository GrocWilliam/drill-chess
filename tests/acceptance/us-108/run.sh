#!/usr/bin/env bash
# US-108 acceptance tests: endgame progress and attempts.
# - http.test.mjs: POST /api/endgames/:id/attempts against the built app (support/server.mjs builds unless FORGE_PREBUILT).
# - module.test.ts: listEndgames, getEndgame, recordAttempt, cascade on account deletion, on PGlite memory:// (Vitest).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
node --test --test-concurrency=1 tests/acceptance/us-108/http.test.mjs || status=1
PGLITE_DATA_DIR=memory:// npx vitest run --config tests/acceptance/us-108/vitest.config.mjs || status=1
exit $status
