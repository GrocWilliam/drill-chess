#!/usr/bin/env bash
# US-91 acceptance tests: SM-2 card scheduling through the review endpoint.
# - sm2.test.ts (Vitest): the pure scheduler (intervals 1/6/16, ease steps and floor, dueOn across a year end).
# - module.test.ts (Vitest, PGlite memory://): openings.reviewCard (UTC date of now, null cases, summary, account deletion).
# - http.test.mjs: POST /api/openings/cards/<id>/review and /openings counts against the built app. The app runs on a
#   disk PGlite directory and is restarted once so the test can read the card ids (the drill endpoint does not exist yet).
# Builds once (support/server.mjs) unless FORGE_PREBUILT is set.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
node --test --test-concurrency=1 tests/acceptance/us-91/http.test.mjs || status=1
PGLITE_DATA_DIR=memory:// npx vitest run --config tests/acceptance/us-91/vitest.config.mjs || status=1
exit $status
