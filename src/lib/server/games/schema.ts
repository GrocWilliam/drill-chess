// Tables of the `game-import` module: linked usernames, import jobs, games.
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../accounts/schema';

export const linkedAccounts = pgTable(
  'linked_accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    site: text().notNull(),
    username: text().notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => [
    unique('linked_accounts_user_id_site_unique').on(t.userId, t.site),
    check('linked_accounts_site_check', sql`${t.site} in ('chesscom', 'lichess')`),
  ],
);

export const importJobs = pgTable(
  'import_jobs',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    site: text().notNull(),
    status: text().notNull().default('queued'),
    imported: integer().notNull().default(0),
    skipped: integer().notNull().default(0),
    error: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    check('import_jobs_site_check', sql`${t.site} in ('chesscom', 'lichess')`),
    check('import_jobs_status_check', sql`${t.status} in ('queued', 'running', 'done', 'failed')`),
    /** At most one queued or running job per user. */
    uniqueIndex('import_jobs_one_active_per_user_idx')
      .on(t.userId)
      .where(sql`${t.status} in ('queued', 'running')`),
    index('import_jobs_user_id_idx').on(t.userId),
  ],
);

export const games = pgTable(
  'games',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    site: text().notNull(),
    siteGameId: text('site_game_id').notNull(),
    url: text().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    timeClass: text('time_class').notNull(),
    clock: text().notNull(),
    colour: text().notNull(),
    result: text().notNull(),
    whiteName: text('white_name').notNull(),
    blackName: text('black_name').notNull(),
    whiteRating: integer('white_rating'),
    blackRating: integer('black_rating'),
    eco: text(),
    opening: text(),
    pgn: text().notNull(),
    plies: integer().notNull(),
  },
  (t) => [
    unique('games_user_id_site_site_game_id_unique').on(t.userId, t.site, t.siteGameId),
    index('games_user_id_ended_at_idx').on(t.userId, t.endedAt.desc()),
    check('games_site_check', sql`${t.site} in ('chesscom', 'lichess')`),
    check('games_time_class_check', sql`${t.timeClass} in ('bullet', 'blitz', 'rapid', 'classical', 'daily')`),
    check('games_colour_check', sql`${t.colour} in ('white', 'black')`),
    check('games_result_check', sql`${t.result} in ('win', 'draw', 'loss')`),
  ],
);
