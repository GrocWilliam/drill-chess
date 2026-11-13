#!/usr/bin/env bash
# US-23 acceptance tests: paging the games list and the 5,000-games cap (HTTP and browser), against the fake Lichess of
# tests/acceptance/support/fakes/ (extended: `many_pawns` streams 5,005 games mp000001..mp005005). The server is started
# by support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-23/http.test.mjs tests/acceptance/us-23/browser.test.mjs
