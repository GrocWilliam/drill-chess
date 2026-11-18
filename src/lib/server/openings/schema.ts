// Tables of the `openings` module: repertoires, their moves (a graph keyed by normalised FEN) and the cards.
import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, real, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../accounts/schema';

export const repertoires = pgTable(
  'repertoires',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    colour: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('repertoires_user_colour_unique').on(t.userId, t.colour),
    check('repertoires_colour_check', sql`${t.colour} in ('white', 'black')`),
  ],
);

export const repertoireMoves = pgTable(
  'repertoire_moves',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repertoireId: uuid('repertoire_id')
      .notNull()
      .references(() => repertoires.id, { onDelete: 'cascade' }),
    fromFen: text('from_fen').notNull(),
    toFen: text('to_fen').notNull(),
    san: text().notNull(),
    uci: text().notNull(),
    by: text().notNull().$type<'player' | 'opponent'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('repertoire_moves_from_uci_unique').on(t.repertoireId, t.fromFen, t.uci),
    uniqueIndex('repertoire_moves_player_unique').on(t.repertoireId, t.fromFen).where(sql`${t.by} = 'player'`),
    index('repertoire_moves_to_fen_idx').on(t.repertoireId, t.toFen),
    check('repertoire_moves_by_check', sql`${t.by} in ('player', 'opponent')`),
  ],
);

export const cards = pgTable(
  'cards',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repertoireMoveId: uuid('repertoire_move_id')
      .notNull()
      .unique()
      .references(() => repertoireMoves.id, { onDelete: 'cascade' }),
    ease: real().notNull().default(2.5),
    intervalDays: integer('interval_days').notNull().default(0),
    reps: integer().notNull().default(0),
    dueOn: date('due_on', { mode: 'string' }).notNull(),
  },
  (t) => [index('cards_user_due_idx').on(t.userId, t.dueOn)],
);
