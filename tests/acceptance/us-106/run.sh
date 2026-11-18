#!/usr/bin/env bash
# US-106 acceptance tests: the endgame draw rule and endgame test ids are documented, and the earlier stories' tests pass.
# Criteria (from the story):
#  1. docs/prd.md Endgame trainer section contains "20 moves" and names stalemate, threefold repetition,
#     insufficient material and the 50-move rule as earlier draws.
#  2. docs/prd.md no longer contains "≤ 4 pieces left and 30 moves played".
#  3. docs/ui.md Test ids section lists the endgame ids in backticks (nav-endgames, endgames-level-<n>, ...).
#  4. docs/ui.md Components section contains EndgamePlay.
#  5. CLAUDE.md still links docs/prd.md, docs/architecture.md and docs/ui.md, and points at the endgames module.
#  6. The us-43, us-70 and us-85 acceptance tests still pass (regression.test.mjs runs their run.sh).
# The document tests read the files only; regression.test.mjs runs the other folders' run.sh (us-70 may build the app
# unless FORGE_PREBUILT is set, and needs CHROMIUM_PATH and PLAYWRIGHT_DIR for its browser tests, as in CI).
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-106/docs.test.mjs tests/acceptance/us-106/regression.test.mjs
