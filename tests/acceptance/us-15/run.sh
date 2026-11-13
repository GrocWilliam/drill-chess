#!/usr/bin/env bash
# US-15 acceptance tests: the import job loop and the chess.com first import (GET /api/import/status), plus `make test`.
# The app runs against the fake chess.com of tests/acceptance/support/fakes/ (fixtures: support/fakes/chesscom-games.mjs);
# builds once unless FORGE_PREBUILT is set.
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-15/http.test.mjs tests/acceptance/us-15/repository.test.mjs
