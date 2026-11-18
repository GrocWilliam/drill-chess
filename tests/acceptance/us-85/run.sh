#!/usr/bin/env bash
# US-85 acceptance tests: the openings architecture is documented in docs/architecture.md, docs/ui.md and CLAUDE.md,
# and the us-43 fixture carries the new Deployment text. No server, no browser, no build: the tests read the documents.
# Criteria (from the story):
#  1. architecture.md src/lib/chess/ row: openingFor(uci[]), static/openings/openings.tsv, "imported by server code
#     only", `Board.svelte` takes `shapes`.
#  2. architecture.md: a src/params/ row naming colour and white|black; the components row names BoardLayout.svelte.
#  3. architecture.md game-import module row depends on board and mentions the startup backfill.
#  4. architecture.md dependency rules contain "browser code never imports openings.ts".
#  5. architecture.md openings data model line: partial unique (repertoire_id, from_fen) where by = 'player',
#     at most 2,000 player moves per repertoire, every walk tracks visited positions.
#  6. architecture.md interfaces: 409 `player_move_exists`/`repertoire_full`, {moves: [], nextDue}.
#  7. architecture.md Deployment: then `games.backfillOpenings()`.
#  8. architecture.md and the updated us-43 fixture: us-43's Stack, Configuration, Deployment and Testing checks pass.
#  9. ui.md Test ids lists every openings id in backticks.
# 10. ui.md names BoardLayout and OpeningDrill.
# 11. CLAUDE.md still links docs/prd.md, docs/architecture.md and docs/ui.md.
# Also (story body): CLAUDE.md Layout has one line on the openings module, its two paths, and server-only.
set -euo pipefail
cd "$(dirname "$0")/../../.."
node --test --test-concurrency=1 tests/acceptance/us-85/docs.test.mjs
