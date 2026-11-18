#!/usr/bin/env bash
# US-86 acceptance tests: opening names from the Lichess chess-openings dataset.
# - openings.test.ts (Vitest): openingFor and uciLine.
# - backfill.test.ts, backfill-batches.test.ts (Vitest, PGlite memory://): backfillOpenings.
# - startup.test.ts (Vitest): a server started on a PGlite directory holding games without names, /health then /games.
# - http.test.mjs: dataset file, README, client bundle, and imports against the fake chess.com / Lichess of
#   tests/acceptance/support/fakes/ (the built app; builds once unless FORGE_PREBUILT is set).
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
status=0
node --test --test-concurrency=1 tests/acceptance/us-86/http.test.mjs || status=1
npx vitest run --config tests/acceptance/us-86/vitest.config.mjs || status=1
exit $status
