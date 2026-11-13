#!/usr/bin/env bash
# US-9 acceptance tests: log in with the next parameter (HTTP form posts, redirects, i18n, browser flows, layout).
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-9/http.test.mjs tests/acceptance/us-9/browser.test.mjs
