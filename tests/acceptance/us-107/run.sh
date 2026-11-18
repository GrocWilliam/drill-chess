#!/usr/bin/env bash
# US-107 acceptance tests: bundled endgame positions, their catalog texts and the rules.ts helpers (Vitest, no server).
set -euo pipefail
cd "$(dirname "$0")/../../.."
[ -d node_modules/vitest ] || npm ci --silent
npx vitest run --config tests/acceptance/us-107/vitest.config.mjs
