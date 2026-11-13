#!/usr/bin/env bash
# US-7 acceptance tests: visitor language and theme, tokens, landing page, layout, no third party, i18n keys.
# The server is started by tests/acceptance/support/server.mjs; browser tests use support/pages.mjs.
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-7/landing.test.mjs tests/acceptance/us-7/browser.test.mjs
