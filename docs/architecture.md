# Architecture

The rules a change must not break; the reviewer rejects changes that do. Product rules are in `docs/prd.md`, the UI
in `docs/ui.md`. Change this file only through a spec that changes the architecture.

## Stack

- Node 26, TypeScript strict, SvelteKit 2 + Svelte 5 (runes), `@sveltejs/adapter-node`.
- Tailwind CSS v4 (CSS-first, tokens in `src/app.css`).
- Drizzle ORM + drizzle-kit migrations on PostgreSQL through `pg` when `DATABASE_URL` is set, else PGlite
  (`PGLITE_DATA_DIR`, default `./data/pglite`; `memory://` in tests).
- Zod 4 at every trust boundary. `nodemailer` for mail.
- Chess: `chess.js` (rules, PGN, FEN, SAN), `chessground` (board, GPL-3.0), `stockfish` npm package, Stockfish 17
  lite single-threaded WASM, run in a Web Worker.
- Tests: Vitest for unit tests (`*.test.ts` next to the code), Node's `node:test` + Playwright (`playwright-core`) for
  acceptance tests.
- Licence: GPL-3.0-or-later (`LICENSE` at the root), because of Stockfish and chessground.
- No other framework, UI library, chart library or state manager.

## Shape and layout

One SvelteKit app, server-rendered, one process on one port.

| Path | What |
|---|---|
| `src/routes/` | Pages, form actions and `api/` endpoints. Thin: parse input, call a module, render. No SQL, no `fetch` to outside services. |
| `src/lib/server/db/` | Drizzle client (`pg` or PGlite), `schema.ts` re-exporting every module's tables, migrations in `drizzle/`. |
| `src/lib/server/<module>/` | One folder per module: `index.ts` (its public functions), `schema.ts` (its tables), `*.test.ts`. |
| `src/lib/server/gateway/` | The only code calling outside services: `chesscom.ts`, `lichess.ts`, `tablebase.ts`, `mail.ts`. |
| `src/lib/server/jobs.ts` | The in-process import job loop. |
| `src/lib/chess/` | Shared, browser-safe chess code: `rules.ts` (chess.js wrapper), `analysis.ts` (win chance, loss, marks, accuracy, phase: pure functions, also used by the server), `engine.ts` (Stockfish worker client), `Board.svelte` (chessground wrapper), `openings.ts` (name lookup). `EvalBar.svelte`, `MoveList.svelte`, `EvalCurve.svelte`. `engine.ts` and chessground run only in the browser (created in `onMount`); `analysis.ts` holds `computeReview`, used by the server and the demo. |
| `src/lib/components/` | Shared UI components (see `docs/ui.md`). `GameReview.svelte` is the board page shared by `/games/[id]` and `/games/demo`. |
| `src/lib/i18n/` | `en.json`, `fr.json` catalogs and `translate`. |
| `static/` | `stockfish/` (WASM and worker, copied from the npm package at build), `openings/` (the dataset), `demo.pgn`. |
| `scripts/` | `copy-stockfish.mjs`, run by `prebuild`/`predev`, copies the lite single-threaded engine to `static/stockfish/stockfish.{js,wasm}` (git-ignored). |
| `src/lib/server/endgames/positions.ts` | The bundled endgame positions. |

## Module map and build order

| Module | Server folder | Responsibility | Depends on |
|---|---|---|---|
| `accounts` | `accounts/` | users, sessions, password reset, preferences (language, theme), account deletion | none |
| `game-import` | `games/` | linked usernames, import jobs, games, game list and filters | `accounts`, `gateway` |
| `board` | (`src/lib/chess/`) | board, rules, engine client, analysis functions | none |
| `game-review` | Server folder `review/` (`index.ts`, `schema.ts`, `demo.ts`) | analyses (validate, compute marks, store), review page, demo game | `game-import`, `board` |
| `stats` | `stats/` | aggregates over games and analyses (read only) | `game-import`, `game-review` |
| `openings` | `openings/` | repertoires, positions, cards, SM-2 scheduling, drills | `accounts`, `board` |
| `endgames` | `endgames/` | bundled positions, attempts, progress, tablebase relay | `accounts`, `board`, `gateway` |

Build order (one spec each, each `Depends on` the previous): 1 `accounts` + `game-import`, 2 `board` +
`game-review`, 3 `stats`, 4 `openings`, 5 `endgames`.

## Dependency rules

- `routes → server/<module> → server/db`; never the reverse. Routes never import `server/db` or `gateway`.
- A module reads and writes only its own tables; it uses another module through that module's `index.ts`. `stats` is
  the one module that reads `games` and `review` tables directly, read only, through queries in `stats/`.
- Only `server/gateway/` calls `fetch` to outside services, with the base URL from its env var.
- `src/lib/chess/` imports nothing from `src/lib/server/` and nothing Node-only; the server imports `analysis.ts` and
  `rules.ts` from it.
- Every server module function takes the `userId` it acts for; no module reads the session itself.
- The `/games` route combines `games` and `review` (the `games-analysed` badge); `games` never imports `review`.

## Data model

Ids are UUID v4 (`gen_random_uuid()`); times are `timestamptz` in UTC. Every user-owned table has `user_id`
referencing `users(id) ON DELETE CASCADE`, so deleting a user deletes everything.

- `accounts`: `users` (id, email unique on `lower(email)`, password_hash, lang `en|fr`, theme `system|light|dark`,
  created_at); `sessions` (id = sha256 of the cookie token, user_id, expires_at); `password_resets` (token_hash,
  user_id, expires_at, used_at); `login_failures` (email_lower, at).
- `game-import`: `linked_accounts` (user_id, site `chesscom|lichess`, username, last_synced_at; unique (user_id,
  site)); `import_jobs` (id, user_id, site, status `queued|running|done|failed`, imported, skipped, error,
  created_at, finished_at); `games` (id, user_id, site, site_game_id, url, ended_at, time_class
  `bullet|blitz|rapid|classical|daily`, clock, colour `white|black`, result `win|draw|loss`, white_name,
  black_name, white_rating, black_rating, eco, opening, pgn, plies; unique (user_id, site, site_game_id); index
  (user_id, ended_at desc)).
- `game-review`: `analyses` (game_id primary key → `games` ON DELETE CASCADE, user_id → `users` ON DELETE CASCADE,
  depth 1–30, evals jsonb: array of `{cp}` or `{mate}` of length plies + 1, from White's point of view, `{mate: 0}` =
  the side to move is mated; best jsonb: array of UCI moves or null of length plies; marks jsonb: array of
  `null|inaccuracy|mistake|blunder` of length plies; phases jsonb: array of `opening|middlegame|endgame` of length
  plies, the phase of the position before each move; accuracy_white, accuracy_black, created_at). Re-analysing
  replaces the row. The server recomputes marks, phases and accuracies from the game's PGN; it never stores marks
  sent by the browser.
- `openings`: `repertoires` (id, user_id, colour; unique (user_id, colour)); `repertoire_moves` (id,
  repertoire_id, from_fen (normalised: no move counters), san, uci, to_fen, by `player|opponent`; unique
  (repertoire_id, from_fen, uci); one `player` move per (repertoire_id, from_fen)); `cards` (repertoire_move_id
  unique (the player's move), ease, interval_days, reps, due_on date).
- `endgames`: `endgame_progress` (user_id, position_id (the bundled id), attempts, passes, streak, mastered_at;
  primary key (user_id, position_id)); `tablebase_cache` (fen primary key, response jsonb, fetched_at).

## Interfaces

- Pages use form actions (POST, `use:enhance`, working without JavaScript) for every write except the two board ones.
- JSON endpoints, under `src/routes/api/`, for what the browser sends from a board page:
  - `POST /api/games/:id/analysis` body `{depth, evals, best}` → 201 `{marks, accuracyWhite, accuracyBlack}` (400
    `invalid_analysis` with `field` `depth|evals|best|body`; 404 for another user's game). Board pages get the engine
    depth as page data (`engineDepth` from `config()`), never through `$env/static/public`; the current ply is
    `?ply=N` (clamped, 0 = start), updated with shallow `replaceState`.
  - `GET /api/import/status` → `{jobs: [{site, status, imported, skipped, error}]}` (the games page polls it).
  - `POST /api/openings/:colour/moves` `{fromFen, uci}`, `DELETE /api/openings/:colour/moves/:id` (and its subtree),
    `GET /api/openings/drill` → the next line, `POST /api/openings/cards/:id/review` `{correct}`.
  - `GET /api/endgames/:id/reply?fen=` → the tablebase move and result; `POST /api/endgames/:id/attempts`
    `{passed}`.
- Errors: JSON `{ "error": { "code": "<snake_case>", "message": "<English text>" } }` with 400 (invalid input, with
  `field`), 401 (signed out), 403, 404 (also for another user's resource), 409 (an import already running, a
  duplicate), 429 (login limit), 502 (an outside service failed). Form actions return `fail(400, {errors: {field:
  code}})`, rendered next to the field in the user's language.
- Outside services, through `gateway`: chess.com `GET /pub/player/{user}/games/archives` and the month archives;
  Lichess `GET /api/games/user/{user}?since=&pgnInJson=true&opening=true` (NDJSON); tablebase `GET
  /standard?fen=`. Each sends `User-Agent: drill-chess (contact: $CONTACT_EMAIL)`, times out after 15s, retries
  once on 429/5xx after the `Retry-After` delay (max 10s), and maps failures to 502.

## Auth

- Session cookie `session`: a random 32-byte token, `httpOnly`, `Secure` (except on `http://localhost`),
  `SameSite=Lax`, 30 days; the database stores its SHA-256. `hooks.server.ts` resolves it to `locals.user`.
- Pages under `/games`, `/stats`, `/openings`, `/endgames` and `/account` redirect signed-out visitors to
  `/login?next=<path>`; API endpoints answer 401. `/games/demo` is public. `/games/demo` never sends anything to the analysis endpoint.
- SvelteKit's CSRF origin check stays on. Passwords: `scrypt` (N=2^15, r=8, p=1, 16-byte salt), compared with
  `timingSafeEqual`.

## Configuration

| Variable | Default | Use |
|---|---|---|
| `PORT` | 8080 | HTTP port |
| `DATABASE_URL` | unset → PGlite | PostgreSQL |
| `PGLITE_DATA_DIR` | `./data/pglite` | PGlite storage, `memory://` in tests |
| `CHESSCOM_URL` | `https://api.chess.com` | chess.com public API |
| `LICHESS_URL` | `https://lichess.org` | Lichess API |
| `TABLEBASE_URL` | `https://tablebase.lichess.ovh` | tablebase |
| `CONTACT_EMAIL` | `unset` → `contact@example.invalid` | User-Agent contact |
| `SMTP_URL` | unset | mail transport; unset → `MAIL_OUTBOX` |
| `MAIL_OUTBOX` | `./data/outbox` | one JSON file per mail when `SMTP_URL` is unset |
| `PUBLIC_ENGINE_DEPTH` | 14 | engine depth (6 in tests) |
| `ORIGIN` | `http://localhost:8080` | adapter-node origin, links in mails |

Every variable is parsed with Zod once, in `src/lib/server/config.ts`.

## Deployment

- `Dockerfile` (multi-stage, `node:26-bookworm-slim`): `npm ci`, `npm run build`, runs `node build` on port 8080.
- `GET /health` answers 200 `{"status":"ok"}` once migrations have run (they run at startup).
- The import job loop starts with the server; jobs left `running` at startup go back to `queued`.

## Testing

- `make test`: `npm ci` then Vitest. `make build`: `npm run build`.
- Acceptance tests in `tests/acceptance/us-N/`, run by `run.sh`; the shared domain layer in
  `tests/acceptance/support/` (page actions, API setup, `server.mjs` to start the app with `PGLITE_DATA_DIR=memory://`,
  `PUBLIC_ENGINE_DEPTH=6` and the fakes' URLs).
- Fakes in `tests/acceptance/support/fakes/`: one Node HTTP server answering the chess.com, Lichess and tablebase
  paths above from recorded fixtures (games of made-up players), with switches to answer 404, 429 and 500. Mail is
  read from `MAIL_OUTBOX`.
- Unit tests cover every pure function of `src/lib/chess/analysis.ts`, SM-2, phases, and the gateway's parsing.
