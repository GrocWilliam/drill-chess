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
  `map-chesscom.ts`). chess.com first import = the archives of the current UTC month and the 2 previous. Lichess first import = `lichess.streamGames` (NDJSON, `since` = 1st of the month 2 months ago, UTC) mapped by pure `map-lichess.ts`; a game without clock stores `clock` `''`. `games.requestSync(userId, site)` (ok | `import_running` | `not_linked`) backs the `?/sync` action (`syncAction` in `link-action.ts`); first import vs sync is decided when the job runs (no stored game for the site = first import; else chess.com refetches from the newest game's month, Lichess uses `since` newest `ended_at` + 1 ms; a sync does not re-count skipped games older than the newest stored one). After every job (done or failed) `capGames` keeps the user's 5,000 newest games by `ended_at`. `games/filters.ts` (`parseFilters(url.searchParams)` with Zod `.catch(undefined)`, `filterConditions`; `/games` filters form is a plain GET form, `games-none` when linked but no match). `/games?page=N` (invalid → 1; `+page.server.ts` builds `prevHref`/`nextHref` from the filter values, shown as `games-prev`/`games-next` links; no JS needed). `GET /api/import/status` → latest job per site. `listGames(userId, filters, page)` (50 per page, newest `ended_at` first) / `getGame(userId, id)` (null for a non-UUID) / `movesText(pgn)`; `/games/[id]` answers 404 through its `+error.svelte`. `unlinkAccount(userId, site)` (`?/unlink` on `/account`, dialog `?modal=unlink-<site>`; `import_running` while any job of the user is active) deletes the site's link, games and jobs. `src/lib/server/link-action.ts` is the `?/link` action shared by `/account` and `/games`; `LinkForm` is the per-site form.
- `src/lib/server/gateway/`: the only code reaching outside (`http.ts` `httpGet`: User-Agent, 15 s timeout, one retry, `GatewayError`; `chesscom.ts` (`listArchives`,
  `fetchArchive`, Zod-validated), `lichess.ts`; `mail.ts` `sendMail`: nodemailer with `SMTP_URL`, else a JSON file in `MAIL_OUTBOX`). Password reset: `accounts.requestPasswordReset`/`resetPassword`; `/reset/[token]` GET with a bad token is `error(400)` rendered by its `+error.svelte`.
- Auth: `hooks.server.ts` `handle` resolves the `session` cookie to `locals.user` (its `lang`/`theme` override the
  cookies), then applies `src/lib/server/guard.ts` (private prefixes → `/login?next=…`, `/`, `/signup` and `/login` → `/games`);
  add new private sections there. Layout data has `signedIn`; `Nav` shows the signed-in bars (`nav-tabs` below 768px).
- `src/lib/i18n/`: `en.json`/`fr.json` (same keys, flat dotted), `translate`, `pickLang`; `hooks.server.ts` `handle` reads the
  `lang`/`theme` cookies into `locals` and fills `%lang%`/`%theme%` of `app.html`; `+layout.server.ts` passes `messages`.
- `/games` import status line: `games-status` from `visibleStatuses` (queued/running/failed, or done <24 h; a failed line is `role="alert"`, `games.status.failed.<error>`, retried by the `games-sync-<site>` buttons); while `data.active` the page polls `/api/import/status` every 2 s then `invalidateAll()`, and the head has `<noscript>` meta refresh. Plurals: `translatePlural` with `<key>_one`/`_other` keys. `LinkForm` calls `invalidateAll()` instead of `goto` when the redirect targets the current page (a client navigation would break the no-reload acceptance check).
- `src/lib/chess/rules.ts`: browser-safe chess.js wrapper (`countPlies`); never imports `src/lib/server/`.
- `src/lib/components/`: `Button`,  `Toast`, `Field`, `Card`, `Badge`, `EmptyState`, `Nav`, `ResponsiveTable` (one markup: table from 768px, row cards below; rows click through to `href` and cells hold the real links), `Modal` (open `<dialog>` rendered by the server when `?modal=<kind>`; a failed form action must also show it, as its URL lacks the param). All visible text goes through `translate`.
- `src/app.css`: Tailwind and the design tokens of `docs/ui.md` (`bg-bg`, `text-muted`, `border-border`, …).
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

- npm 11 here does not run dependencies' install scripts; esbuild still works through its `@esbuild/*` package.
- Code imported by routes is also loaded at build time: never parse config or open the database at module load.
