#!/usr/bin/env bash
# US-44 acceptance tests: pure chess helpers (rules.ts, analysis.ts) through Vitest; no server needed.
set -euo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
npx vitest run --config tests/acceptance/us-44/vitest.config.mjs
