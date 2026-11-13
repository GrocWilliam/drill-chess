#!/usr/bin/env bash
# US-10 acceptance tests: login limit of 10 failures per lower-cased email in 15 minutes.
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-10/http.test.mjs tests/acceptance/us-10/browser.test.mjs
