#!/usr/bin/env bash
# US-22 acceptance tests: the games filters (HTTP and browser), against the fake chess.com and Lichess of
# tests/acceptance/support/fakes/ (13 games: alpha_pawn 7, beta_rook 6). The server is started by support/server.mjs
# (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-22/http.test.mjs tests/acceptance/us-22/browser.test.mjs
