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
