#!/usr/bin/env bash
# US-6 acceptance tests: project setup, config, database, /health, licence, Dockerfile, CLAUDE.md.
# The server is started by tests/acceptance/support/server.mjs (builds once unless FORGE_PREBUILT is set,
# free port in 10000-32767, waits for /health, stops it at the end of each test).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-6/repository.test.mjs tests/acceptance/us-6/server.test.mjs
