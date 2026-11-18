// Tables of the `endgames` module: per-user progress and the tablebase response cache.
import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../accounts/schema';

export const endgameProgress = pgTable(
  'endgame_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    positionId: text('position_id').notNull(),
    attempts: integer().notNull().default(0),
    passes: integer().notNull().default(0),
    streak: integer().notNull().default(0),
    masteredAt: timestamp('mastered_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.positionId] })],
);

export const tablebaseCache = pgTable('tablebase_cache', {
  fen: text().primaryKey(),
  response: jsonb().notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});
