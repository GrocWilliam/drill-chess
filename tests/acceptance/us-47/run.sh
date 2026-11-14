#!/usr/bin/env bash
# US-47 acceptance tests: replay of the demo game (move list, controls, keys, flip, ply in the URL, free play,
# French labels, 44px controls). The server is started by support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-47/http.test.mjs tests/acceptance/us-47/browser.test.mjs
