#!/usr/bin/env bash
# US-17 acceptance tests: the Lichess first import (HTTP, against the fake Lichess of tests/acceptance/support/fakes/,
# fixtures: support/fakes/lichess-games.mjs), plus `make test` for the Vitest tests of map-lichess.ts.
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-17/http.test.mjs tests/acceptance/us-17/repository.test.mjs
