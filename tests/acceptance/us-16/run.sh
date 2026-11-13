#!/usr/bin/env bash
# US-16 acceptance tests: the games list and a game's details (HTTP and browser), against the fake chess.com
# of tests/acceptance/support/fakes/ (month 0 fixture of alpha_pawn pinned by this story).
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-16/http.test.mjs tests/acceptance/us-16/browser.test.mjs
