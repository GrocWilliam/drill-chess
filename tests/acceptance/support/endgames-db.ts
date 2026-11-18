// Database helpers for the endgames module (US-108), for Vitest acceptance tests on the process `db`
// (PGLITE_DATA_DIR=memory://). Setup and reads only: no assertions of a criterion here.
import { sql } from 'drizzle-orm';

/** Migrates the process database → the endgames module. */
export async function endgamesModule() {
  const dbm = await import('../../../src/lib/server/db/index');
  await dbm.migrate();
  return await import('../../../src/lib/server/endgames/index');
}

/** A user with a real password hash → { id, password }. */
export async function newUser(): Promise<{ id: string; password: string }> {
  const { db } = await import('../../../src/lib/server/db/index');
  const { users } = await import('../../../src/lib/server/accounts/schema');
  const { hashPassword } = await import('../../../src/lib/server/accounts/password');
  const password = 'correct-horse-1';
  const [u] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash: await hashPassword(password) }).returning();
  return { id: u.id as string, password };
}

export async function deleteAccountOf(userId: string, password: string) {
  const accounts = await import('../../../src/lib/server/accounts/index');
  return accounts.deleteAccount(userId, password);
}

/** Number of endgame_progress rows of a user. */
export async function progressRowCount(userId: string): Promise<number> {
  const { db } = await import('../../../src/lib/server/db/index');
  const res: any = await db.execute(sql`select count(*)::int as n from endgame_progress where user_id = ${userId}`);
  return Number((res.rows ?? res)[0].n);
}

/** The progress of one position as `listEndgames` shows it, or undefined. */
export async function listedProgress(m: any, userId: string, id: string) {
  const levels = await m.listEndgames(userId);
  return levels.flatMap((l: any) => l.positions).find((p: any) => p.id === id)?.progress;
}
