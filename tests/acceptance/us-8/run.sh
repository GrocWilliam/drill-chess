#!/usr/bin/env bash
# US-8 acceptance tests: signup, sessions, logout, route guards, signed-in language/theme, signed-in layout.
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set,
# free port in 10000-32767, ORIGIN http://localhost:<port>, waits for /health); browser tests use support/pages.mjs.
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-8/http.test.mjs tests/acceptance/us-8/browser.test.mjs
