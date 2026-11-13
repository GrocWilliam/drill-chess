#!/usr/bin/env bash
# US-14 acceptance tests: link a chess.com or Lichess username (HTTP form posts, browser with and without JS).
# The app runs against the fake sites of tests/acceptance/support/fakes/server.mjs; builds once unless FORGE_PREBUILT is set.
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-14/http.test.mjs tests/acceptance/us-14/browser.test.mjs
