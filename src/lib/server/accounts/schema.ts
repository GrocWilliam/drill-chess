// Tables of the `accounts` module: users, sessions, password resets, login failures.
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    passwordHash: text('password_hash').notNull(),
    lang: text().notNull().default('en'),
    theme: text().notNull().default('system'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`),
    check('users_lang_check', sql`${t.lang} in ('en', 'fr')`),
    check('users_theme_check', sql`${t.theme} in ('system', 'light', 'dark')`),
  ],
);

/** id is the hex SHA-256 of the session cookie's token. */
export const sessions = pgTable(
  'sessions',
  {
    id: text().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

/** token_hash is the hex SHA-256 of the token sent by mail. */
export const passwordResets = pgTable(
  'password_resets',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [index('password_resets_user_id_idx').on(t.userId)],
);

export const loginFailures = pgTable(
  'login_failures',
  {
    id: uuid().primaryKey().defaultRandom(),
    emailLower: text('email_lower').notNull(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('login_failures_email_lower_at_idx').on(t.emailLower, t.at)],
);
