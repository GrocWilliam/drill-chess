# Project memory

drill-chess is a free web app where chess players import their own chess.com and Lichess games, review them with an
in-browser engine, and drill their opening repertoire and endgames. It is one server-rendered SvelteKit app on one
port, storing everything in PostgreSQL (PGlite when no `DATABASE_URL`).

This file is the project's memory for the forge's agents. Keep it short, true and current: update it in the same commit
as any change that makes it wrong, and add what the next agent would otherwise rediscover the hard way.

## Stack

Node 26, TypeScript 6 strict, SvelteKit 2 (`@sveltejs/kit@^2`, not 3) + Svelte 5 runes, `@sveltejs/adapter-node@^5`
(v6 needs Kit 3), Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), Zod 4, Drizzle ORM 0.45 (0.x: `relations()`, not
`defineRelations()`) + drizzle-kit 0.31, chess.js 1.4, `pg` / `@electric-sql/pglite`, Vitest 5, `playwright-core` (acceptance).
Licence GPL-3.0-or-later.

## Layout

References: `docs/prd.md` (product), `docs/architecture.md` (structure, enforced by the reviewer), `docs/ui.md` (design).

- `src/hooks.server.ts`: `init()` parses the config, runs the migrations (exits 1 if they fail), then `startJobLoop()`.
- `src/lib/server/jobs.ts`: the one sequential import worker (`resetRunningJobs`, then `claimNextJob` → `runImportJob`);
  wakes on `games.onJobQueued` and polls every 1 s; a job that throws is marked `failed`/`internal` if its row exists.
- `src/routes/`: pages and endpoints, thin; `health/+server.ts` is `GET /health` (200 once migrated, else 503).
- `src/lib/server/config.ts`: every env var, parsed with Zod; call `config()` (cached), never read `process.env`.
- `src/lib/server/db/`: `index.ts` (`db`, `connect()`, `migrate()`, `ready`), `schema.ts` (re-exports each module's
  `schema.ts`), `drizzle/` (migrations, read at runtime from the working directory).
- `src/lib/server/<module>/`: `index.ts`, `schema.ts`, tests. `accounts/` (`updatePreferences`, `deleteAccount`, signup, login with the 10-failures-per-15-min limit on `login_failures`, sessions, logout, `sessionCookie`,
  `password.ts` scrypt) and `games/` (`linkAccount`, `listLinkedAccounts`, jobs: `claimNextJob`, `runImportJob`, `importStatus`; pure
  `map-chesscom.ts`). chess.com first import = the archives of the current UTC month and the 2 previous. Lichess first import = `lichess.streamGames` (NDJSON, `since` = 1st of the month 2 months ago, UTC) mapped by pure `map-lichess.ts`; a game without clock stores `clock` `''`. `games.requestSync(userId, site)` (ok | `import_running` | `not_linked`) backs the `?/sync` action (`syncAction` in `link-action.ts`); first import vs sync is decided when the job runs (no stored game for the site = first import; else chess.com refetches from the newest game's month, Lichess uses `since` newest `ended_at` + 1 ms; a sync does not re-count skipped games older than the newest stored one). After every job (done or failed) `capGames` keeps the user's 5,000 newest games by `ended_at`. `games/filters.ts` (`parseFilters(url.searchParams)` with Zod `.catch(undefined)`, `filterConditions`; `/games` filters form is a plain GET form, `games-none` when linked but no match). `/games?page=N` (invalid → 1; `+page.server.ts` builds `prevHref`/`nextHref` from the filter values, shown as `games-prev`/`games-next` links; no JS needed). `GET /api/import/status` → latest job per site. `listGames(userId, filters, page)` (50 per page, newest `ended_at` first) / `getGame(userId, id)` (null for a non-UUID) / `movesText(pgn)`; `/games/[id]` (board page: `GameReview` with `save`, `movable="none"`, stored analysis or null, orientation = `game.colour`; `game-details` in the `details` snippet, `game-site-link` in `footer`, `game-moves` inside `<noscript>`) answers 404 through its `+error.svelte`. `unlinkAccount(userId, site)` (`?/unlink` on `/account`, dialog `?modal=unlink-<site>`; `import_running` while any job of the user is active) deletes the site's link, games and jobs. `src/lib/server/link-action.ts` is the `?/link` action shared by `/account` and `/games`; `LinkForm` is the per-site form.
- Opening names: `static/openings/openings.tsv` (Lichess chess-openings, CC0, committed, never fetched); `src/lib/chess/openings.ts` `openingFor(uci[])` (server only, lazy index) + `rules.ts` `uciLine`; `games/opening.ts` `withOpening(row)` (both import paths) and `backfillOpenings()` (run by `init` after `migrate()`, failure only logged).
- `src/lib/server/review/` (module `game-review`): table `analyses` (one per game, cascades from `games` and `users`, so
  unlink/delete/cap need no review code); `saveAnalysis(userId, gameId, body)` (game via `games.getGame`, Zod
  `analysisBody` field by field in the order depth, evals, best, non-object → `body`, then counts vs the PGN, then
  `computeReview`, upsert), `getAnalysis`, `accuracies(userId, ids)` → `Map`. Accuracies are `real` (float4): read
  back rounded to one decimal. Imports `src/lib/chess/` relatively (acceptance Vitest has no `$lib` alias).
  `POST /api/games/[id]/analysis` (`api/games/[id]/analysis/+server.ts`): 401, non-JSON → 400 `body`, 201/400/404.
  `/games` `+page.server.ts` combines both: `analysed` (gameId → accuracy of the player's side, for the `games-analysed` badge).
- `/stats` (`routes/stats`): the openings block lists the name cell LAST (acceptance reads the figures as the first integers of the row text, and names hold digits); `openingHrefs` in `+page.server.ts`; `+page.server.ts` builds `values` (`all` for unset site/time), `emptyHref`, `timeHrefs`; blocks colour and time use `ResponsiveTable` (`rowAttrs` adds `data-colour`/`data-time`) and `components/ResultBar.svelte`; the first column's text must hold no digits besides the figures (acceptance parses them); the last block `stats-mistakes` (plain table, `stats-mistakes-empty` when `mistakes.games` is 0) shows `mistakes` with `formatOneDecimal`.
- `src/lib/server/stats/` (read only, no `schema.ts`; queries `games`/`analyses` tables directly, the one module allowed to): pure `filters.ts` `parseStatsFilters(params, now)` (`site`, `time`, `period` 30d|90d|365d|all → `since` = now − N×24 h, `openingsColour`, `series` `<site>-<time>`; Zod `.catch`), pure `score.ts` `scorePercent`, `index.ts` `getStats(userId, f)` (one grouped `count(*) filter` query per block, `Promise.all`; `colour`, `time`, `openings` (top 10, null-opening games one group, ordered by games, exact score ratio, eco nulls last, opening; `openingsColour` only affects it), `mistakes` (analysed games joined to `analyses`, player's plies only, marks ÷ analysed games, one decimal) filled; `rating` = `{series}` per (site, time class), points by `ended_at`, player-side rating, null left out); `score.ts` `pickSeries(series, requested?)` → index or -1. Must answer < 1 s at 5,000 games + 1,000 analyses (timing test in `index.test.ts`). `GET /api/stats` (`api/stats/+server.ts`, 401 checked itself).
- `/stats` rating block: `+page.server.ts` returns `selectedSeries = pickSeries(...)` (-1 = none); the `series` select (`stats-rating-series`) lives in the `stats-filters` form; `components/RatingChart.svelte` (inline SVG + `<details>` table); fewer than 2 points → `stats-rating-not-enough`. A signed-in user's stored `lang` wins over the `lang` cookie.
- `src/lib/server/openings/` (`schema.ts`: `repertoires`, `repertoire_moves`, `cards`; `index.ts`: `addMove` → `{status, move}` or `{error: {code, san?}}`, `explore`, `summary`; positions keyed by `normaliseFen`, so transpositions share moves). `POST /api/openings/[colour=colour]/moves` (matcher `src/params/colour.ts`). Delete: pure `tree.ts` `reachableAfterDelete`, `deletePreview`/`deleteMove` (move + moves whose `from_fen` becomes unreachable, one transaction, cards cascade), `DELETE …/moves/[id]`; the editor's `?modal=opening-delete&move=<id>` renders `modal-opening-delete` and `?/delete` (303 back to `?line=`; `use:enhance` calls the DELETE endpoint instead). `opening-move` is the `<li>` (it holds the `opening-delete` link; anchors cannot nest) and carries `href`.
- `src/lib/server/gateway/`: the only code reaching outside (`http.ts` `httpGet`: User-Agent, 15 s timeout, one retry, `GatewayError`; `chesscom.ts` (`listArchives`,
  `fetchArchive`, Zod-validated), `lichess.ts`; `mail.ts` `sendMail`: nodemailer with `SMTP_URL`, else a JSON file in `MAIL_OUTBOX`). Password reset: `accounts.requestPasswordReset`/`resetPassword`; `/reset/[token]` GET with a bad token is `error(400)` rendered by its `+error.svelte`.
- Auth: `hooks.server.ts` `handle` resolves the `session` cookie to `locals.user` (its `lang`/`theme` override the
  cookies), then applies `src/lib/server/guard.ts` (private prefixes → `/login?next=…`, `/`, `/signup` and `/login` → `/games`);
  add new private sections there. Layout data has `signedIn`; `Nav` shows the signed-in bars (`nav-tabs` below 768px).
- `src/lib/i18n/`: `en.json`/`fr.json` (same keys, flat dotted), `translate`, `pickLang`; `hooks.server.ts` `handle` reads the
  `lang`/`theme` cookies into `locals` and fills `%lang%`/`%theme%` of `app.html`; `+layout.server.ts` passes `messages`.
- `/games` import status line: `games-status` from `visibleStatuses` (queued/running/failed, or done <24 h; a failed line is `role="alert"`, `games.status.failed.<error>`, retried by the `games-sync-<site>` buttons); while `data.active` the page polls `/api/import/status` every 2 s then `invalidateAll()`, and the head has `<noscript>` meta refresh. Plurals: `translatePlural` with `<key>_one`/`_other` keys. `LinkForm` calls `invalidateAll()` instead of `goto` when the redirect targets the current page (a client navigation would break the no-reload acceptance check).
- `src/lib/chess/rules.ts`: browser-safe chess.js wrapper (`countPlies`, `positions`, `legalMoves`, `play`, `normaliseFen`, `turn`, `sanOf`, `uciOf` SAN-or-UCI → UCI, `isPromotion`, `inCheck`, `terminal` checkmate|stalemate|null); `analysis.ts`: pure `winChance`/`moveLoss`/`mark`/`accuracy`/`phase`/`computeReview`/`evalText` (evals from White's view; `winChance(ev, sideToMove)` makes `{mate: 0}` the mated side's loss); neither imports `src/lib/server/`.
- `src/lib/chess/engine.ts` (browser only, create in `onMount`): `createEngine(signal?)` → Promise (rejects `engine_failed` when the worker errors, e.g. a 404; `engine_stopped` on abort), `runAnalysis(fens, depth, onProgress)` → `{result, cancel}` (cancel stops the engine even while it starts; components use this), `engine.analyse(fens, depth, onProgress)` → `{evals (fens.length, White's view), best (plies, UCI)}`, `stop()`; pure `parseInfo`/`toWhite`/`parseBestMove`, unit-tested with a fake `Worker` (`vi.stubGlobal`). `EvalBar.svelte` (`eval-bar` meter, props `ev`, `turn`); `EvalCurve.svelte` (inline SVG, `eval-curve-ply` rect per ply, `<details>` table; shown once the analysis is done; wins computed in `GameReview`); `MoveList` takes `marks` and `messages` (`review.mark.<mark>` in the label).
- `src/lib/chess/Board.svelte`: the shared chessground board (created in `onMount`; SSR outputs the empty `board` element with
  `data-fen`/`data-orientation`); props `messages`, `fen`, `orientation`, `movable`, `lastMove`, `onMove(uci)`, `shapes` (arrows → `drawable.autoShapes`, only set when passed); the parent
  owns the position. Promotion chooser `board-promotion`, typed-move field `board-move-input`. chessground's `.cg-wrap`
  sets `position: relative`, so size the board element with `h-full w-full` inside an `aspect-square` box, never `absolute`.
- `scripts/copy-stockfish.mjs` (`prebuild`/`predev`): copies Stockfish 17 lite single-threaded from `node_modules/stockfish`
  to the git-ignored `static/stockfish/stockfish.{js,wasm}`.
- `src/lib/components/GameReview.svelte` (board page: `EvalBar`, `Board`, `chess/MoveList.svelte`, controls, keys; ply in `?ply=N` via shallow `replaceState`; a board move = free play until back-to-game/any control, the eval bar/best move stay on the game ply; `details` snippet; props `lang`, `engineDepth`, `save`). With `analysis` null it runs the engine in `onMount` (`review-progress`, then `review-best`/`review-accuracy`, or `review-error` + `review-retry`); `save` false computes the review locally; `save` true POSTs `{depth, evals, best}` (`components/save-analysis.ts`) and shows the server's marks/accuracies, else `review-error` `review.save_error` (retry reruns engine + POST); `review-reanalyse` only with `save`. `review-error` holds only the message (`review-retry` is its sibling). `?ply` parsing: `review/ply.ts` `plyFromQuery`. `/games/demo` (public) uses it with `analysis: null`, `save: false`: the bundled Opera Game, `src/lib/server/review/demo.ts` `demoGame()` reads `static/demo.pgn` with
  `?raw`; free play on the board, `<noscript>` `review-noscript` with the moves. Landing links to it (`landing-demo`).
- `src/lib/components/`: `Button`,  `Toast`, `Field`, `Card`, `Badge`, `EmptyState`, `Nav`, `ResponsiveTable` (one markup: table from 768px, row cards below; rows click through to `href` and cells hold the real links), `Modal` (open `<dialog>` rendered by the server when `?modal=<kind>`; a failed form action must also show it, as its URL lacks the param). All visible text goes through `translate`.
- `src/app.css`: Tailwind and the design tokens of `docs/ui.md` (`bg-bg`, `text-muted`, `border-border`, …).
- `/openings/[colour=colour]` (editor): `load` = `openings.explore` on `?line=`; `components/BoardLayout.svelte` (board + panel snippets, same 375/1024px rules as `GameReview`); `+page.svelte` POSTs unknown moves to `/api/openings/<colour>/moves`, then `goto`s the deeper line; errors are `openings.error.<code>` (`player_move_exists` takes `{san}`, read from the API message).
- `/openings` (home, `routes/openings/`): `load` = `openings.summary(userId, now)` → the two cards (`openings-white`/`-black`); a colour without a repertoire shows `openings-empty` and no counts. Its `drill-start*` links target `/openings/drill`.
- Drill: pure `openings/drill.ts` (`mulberry32`, `pickWeighted`, `graphOf`, `dueBelow`, `pickLine`); `openings.nextLine(userId, colours, now, seed?)` loads the colours' moves + cards in one query; only repertoires with a due card are candidates (else `{moves: [], nextDue}`), so `both` never picks a repertoire without due cards. `GET /api/openings/drill?colour=&seed=` (`api/openings/drill/+server.ts`, 400 `invalid_query`).
- `/openings/drill` (`routes/openings/drill`): `load` = `{colour (white|black, else both), seed (int ≥ 0 or null), first: openings.nextLine}` (query parsed by `parseDrillQuery`); `components/OpeningDrill.svelte` plays it (pure logic in `components/opening-drill.ts`: `stepAt`, `judge`, `lineQuery` = seed + k for line k); `drill-board` wraps `Board` (which keeps `data-testid="board"`); no line left → `drill-none`. `+page.svelte` remounts it with `{#key data.first}`. The drill ends (`drill-summary`, right/wrong counted from the reviews sent) once 20 cards are reviewed (`finish()` fetches line k+1 once: a line → next due "today", else `nextDue`) or when a fetched line has no moves; fetched lines without a due card are skipped by the client (no auto-play). Board orientation/`movable` follow each line's colour. `rules.ts` `uciOf` also reads French piece letters (R D T F C) as a fallback.
- `openings/sm2.ts` pure `review(state, correct, today)`; `openings.reviewCard(userId, cardId, correct, now)` → card or null; `POST /api/openings/cards/[id]/review` `{correct}` (200 `{card}`, 400 `invalid_body`, 404, 401).
- The openings module follows `docs/architecture.md` (`src/lib/server/openings/`; `src/lib/chess/openings.ts` is server-only, browser code never imports it).
- `tests/acceptance/`: frozen story tests; `support/server.mjs` starts `node build`.

## Conventions

- Tables: `uuid().primaryKey().defaultRandom()`, `timestamp(..., { withTimezone: true })`, snake_case column names
  given explicitly, enums as `text` + `check(...)`, `user_id` → `users.id` `onDelete: 'cascade'`.
- Schema change: edit the module's `schema.ts`, then `npx drizzle-kit generate --name <short_name>`; commit the SQL and
  `meta/`. Never edit a migration already on `main`.
- Unit tests next to the code (`*.test.ts`); database tests use `connect({ pgliteDataDir: 'memory://' })` + `migrate()`,
  or, to test a module using the process `db`, `vi.stubEnv('PGLITE_DATA_DIR', 'memory://')` then `migrate()` (see
  `accounts/index.test.ts`).
- JSON endpoints answer errors as `{ error: { code, message } }` (401 `unauthorized` checked in the endpoint: the
  guard only redirects pages).
- Form errors: actions return `fail(400, { <fields>, errors: { field: code } })`; the page shows
  `translate('<page>.error.<code>')` in the `Field`'s `error` (rendered with `role="alert"`).

## Commands

```sh
make test     # npm ci, then Vitest
make build    # npm ci, then npm run build (→ build/)
npm run check # svelte-check (types)
PGLITE_DATA_DIR=memory:// node build              # run the built app (PORT defaults to 8080)
FORGE_PREBUILT=1 bash tests/acceptance/us-6/run.sh # one story's acceptance tests (drop FORGE_PREBUILT to build first)
```

## Skills

The forge's defaults are the `stack-ui`, `stack-api`, `stack-db`, `stack-tests`, `stack-debug`, `stack-i18n` and `stack-security` skills. Where this
project differs, say so here; project-specific how-tos go in `.claude/skills/`. Differences: migrations live in
`src/lib/server/db/drizzle/` (not `./drizzle`), schema in `src/lib/server/db/schema.ts`.

## Pitfalls

- Board page at 1024px has no spare width (24 + 608 + 380 px): `GameReview` drops the `main` padding and uses 4px gaps from `lg:`; chessground's coordinates overflow the board by 1px, so `.board-col` clips `overflow-x`. Move buttons are 44×44px (acceptance measures every button and link).
- npm 11 here does not run dependencies' install scripts; esbuild still works through its `@esbuild/*` package.
- `+page.server.ts` may only export SvelteKit's names (`load`, `actions`, …): put helpers to unit-test in `src/lib/`.
- Code imported by routes is also loaded at build time: never parse config or open the database at module load.
- A test that starts PGlite on disk or runs all migrations in its body (not in `beforeAll`) needs its own 120 s timeout:
  the 30 s default fails under CI load.
- Zipping two jsonb arrays: use one `rows from (jsonb_array_elements_text(a), jsonb_array_elements_text(b)) with ordinality`;
  joining two `with ordinality` scans on `n` re-runs the second per row (PGlite: ~1 s at 1,000 analyses).
- CI shard `acceptance-N` runs every `tests/acceptance/*/run.sh` whose index (glob order) % 6 = N, not only this story's;
  list them with `i=0; for s in tests/acceptance/*/run.sh; do [ $((i++ % 6)) -eq N ] && echo $s; done` to reproduce.
- A bare `|` in a `docs/architecture.md` table cell (`white|black` in the `src/params/` row) splits the cell; the us-85
  check reads the literal text, so keep it and accept the split.
- adapter-node copies `static/` to `build/client`: `postbuild` deletes `build/client/openings` so the dataset is not served (the bundle must not hold opening names).
- Building the openings index (`parseOpenings`) takes seconds of synchronous chess.js work: `init` warms it before `/health`; built on the first import instead, it stalls the event loop and the server drops keep-alive sockets (`other side closed` in acceptance).
- Acceptance helpers that block this process for seconds (replaying the dataset) must run at module load, not between requests: idle fetch sockets go stale (`other side closed`).
- Acceptance Vitest configs have no `$lib` alias: server modules the acceptance support helpers import (`accounts/`, `openings/`, `db/`) must import `src/lib/` code relatively, not through `$lib`.
- Page code must read the body of every fetch response (even when only `res.ok` matters): acceptance helpers awaiting Playwright's `response.json()` hang forever on a body the page never consumed.
