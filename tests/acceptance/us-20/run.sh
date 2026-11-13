#!/usr/bin/env bash
# US-20 acceptance tests: sync new games and refuse a second import while one runs (HTTP and browser), against the
# fake chess.com / Lichess of tests/acceptance/support/fakes/ (extended: POST /__fake/add-game, `fake.addGame(...)`).
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-20/http.test.mjs tests/acceptance/us-20/browser.test.mjs
