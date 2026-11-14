#!/usr/bin/env bash
# US-43 acceptance tests: the board and game-review design is documented in docs/architecture.md and docs/ui.md.
# No server and no browser: the tests read the documents. Criteria (from the story):
#  1. architecture.md: the game-review data model line has `user_id → users ON DELETE CASCADE`, `phases jsonb` and
#     "it never stores marks sent by the browser".
#  2. architecture.md contains scripts/, copy-stockfish.mjs, GameReview.svelte, computeReview, engineDepth, ?ply=N and
#     "`/games/demo` never sends anything to the analysis endpoint".
#  3. architecture.md contains "`games` never imports `review`" and the field values depth|evals|best|body.
#  4. architecture.md Stack, Configuration, Deployment and Testing sections are unchanged from main.
#  5. ui.md contains every test id of the story (and data-fen, data-orientation) in its Test ids section.
#  6. ui.md no longer contains "the demo link comes with the game-review module".
#  7. CLAUDE.md still links docs/prd.md, docs/architecture.md and docs/ui.md.
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-43/docs.test.mjs
