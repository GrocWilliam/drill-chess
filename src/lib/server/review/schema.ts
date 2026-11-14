// Tables of the `game-review` module: one stored analysis per game.
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, real, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../accounts/schema';
import { games } from '../games/schema';

export const analyses = pgTable(
  'analyses',
  {
    gameId: uuid('game_id')
      .primaryKey()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    depth: integer().notNull(),
    /** P + 1 evaluations from White's point of view: `{cp}` or `{mate}`. */
    evals: jsonb().$type<({ cp: number } | { mate: number })[]>().notNull(),
    /** P best moves in UCI (or null), of the position before each move. */
    best: jsonb().$type<(string | null)[]>().notNull(),
    marks: jsonb().$type<('inaccuracy' | 'mistake' | 'blunder' | null)[]>().notNull(),
    phases: jsonb().$type<('opening' | 'middlegame' | 'endgame')[]>().notNull(),
    accuracyWhite: real('accuracy_white').notNull(),
    accuracyBlack: real('accuracy_black').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('analyses_user_id_idx').on(t.userId),
    check('analyses_depth_check', sql`${t.depth} between 1 and 30`),
  ],
);
