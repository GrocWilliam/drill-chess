#!/usr/bin/env bash
# US-19 acceptance tests: unlink a username and delete that site's games (HTTP and browser without JavaScript),
# against the fake sites of tests/acceptance/support/fakes/. The server is started by tests/acceptance/support/server.mjs
# (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-19/http.test.mjs tests/acceptance/us-19/browser.test.mjs
