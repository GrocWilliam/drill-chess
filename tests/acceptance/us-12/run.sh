#!/usr/bin/env bash
# US-12 acceptance tests: language and theme on the account page (HTTP form posts, browser with and without JS).
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-12/http.test.mjs tests/acceptance/us-12/browser.test.mjs
