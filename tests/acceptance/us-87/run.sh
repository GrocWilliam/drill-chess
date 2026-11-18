#!/usr/bin/env bash
# US-87 acceptance tests: repertoires stored through the openings module and its write API.
# - module.test.ts (Vitest, PGlite memory://): addMove, explore, summary, cards, isolation, account deletion, 2,000-move cap.
# - http.test.mjs: POST /api/openings/<colour>/moves against the built app (builds once unless FORGE_PREBUILT is set).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
node --test --test-concurrency=1 tests/acceptance/us-87/http.test.mjs || status=1
PGLITE_DATA_DIR=memory:// npx vitest run --config tests/acceptance/us-87/vitest.config.mjs || status=1
exit $status
