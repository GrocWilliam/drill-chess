#!/usr/bin/env bash
# US-13 acceptance tests: delete the account with a password confirmation (HTTP and browser, with and without JS).
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-13/http.test.mjs tests/acceptance/us-13/browser.test.mjs
