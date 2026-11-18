#!/usr/bin/env bash
# US-89 acceptance tests: the openings home /openings with the nav link.
# - http.test.mjs: access (303 for a visitor), the cards of a new user and of a white repertoire, French.
# - browser.test.mjs: Chromium at CHROMIUM_PATH (nav-openings order, current page, 44px targets, layout at 375 and 1024px).
# Builds once (support/server.mjs) unless FORGE_PREBUILT is set.
set -uo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/chess.js ] || npm ci --silent
node --test --test-concurrency=1 tests/acceptance/us-89/http.test.mjs tests/acceptance/us-89/browser.test.mjs
