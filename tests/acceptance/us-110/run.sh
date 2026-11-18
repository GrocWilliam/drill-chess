#!/usr/bin/env bash
# US-110 acceptance tests: the endgame tablebase relay, GET /api/endgames/:id/reply?fen=, against the built app
# (support/server.mjs builds unless FORGE_PREBUILT) with TABLEBASE_URL pointing at the fake (support/fakes/).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-110/http.test.mjs
