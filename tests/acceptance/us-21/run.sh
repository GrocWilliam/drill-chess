#!/usr/bin/env bash
# US-21 acceptance tests: retry rate-limited calls and report failed imports (HTTP and browser), against the fake
# chess.com / Lichess of tests/acceptance/support/fakes/ (extended: `busy_*` answer 429 with Retry-After: 1 once per
# path; `failing_*` always fail their month 0 archive / game stream), plus `make test` for the gateway's Vitest tests.
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-21/http.test.mjs tests/acceptance/us-21/browser.test.mjs \
  tests/acceptance/us-21/repository.test.mjs
