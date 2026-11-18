#!/usr/bin/env bash
# US-90 acceptance tests: delete a repertoire move with everything only reachable through it.
# - module.test.ts (Vitest, PGlite memory://): deletePreview, deleteMove (reachability, transpositions, cards, isolation).
# - http.test.mjs: DELETE /api/openings/<colour>/moves/<id> and the server-rendered delete modal.
# - browser.test.mjs: Chromium at CHROMIUM_PATH (with and without JavaScript, cancel, French, 375px layout).
# Builds once (support/server.mjs) unless FORGE_PREBUILT is set.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
node --test --test-concurrency=1 tests/acceptance/us-90/http.test.mjs tests/acceptance/us-90/browser.test.mjs || status=1
PGLITE_DATA_DIR=memory:// npx vitest run --config tests/acceptance/us-90/vitest.config.mjs || status=1
exit $status
