#!/usr/bin/env bash
# US-18 acceptance tests: the import status line and the refresh while importing (HTTP and browser), against the
# fake chess.com of tests/acceptance/support/fakes/ (extended: `slow_*` answers after 3 s, `slow_knight` has 4 games).
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-18/http.test.mjs tests/acceptance/us-18/browser.test.mjs
