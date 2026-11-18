// Database setup helpers for the openings module (US-87), for Vitest acceptance tests run on the process `db`
// with PGLITE_DATA_DIR=memory://. Setup and reads only: no assertions of a criterion here.
import { sql } from 'drizzle-orm';

/** Migrates the process database → the openings module. */
export async function openingsModule() {
  const dbm = await import('../../../src/lib/server/db/index');
  await dbm.migrate();
  return await import('../../../src/lib/server/openings/index');
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

async function rows(query: ReturnType<typeof sql>) {
  const { db } = await import('../../../src/lib/server/db/index');
  const res: any = await db.execute(query);
  return (res.rows ?? res) as Record<string, any>[];
}

/** The cards of a user: { ease, interval_days, reps, due_on ('YYYY-MM-DD') }. */
export async function cardsOf(userId: string) {
  const r = await rows(sql`select ease, interval_days, reps, to_char(due_on, 'YYYY-MM-DD') as due_on from cards where user_id = ${userId}`);
  return r.map((x) => ({ ease: Number(x.ease), interval_days: Number(x.interval_days), reps: Number(x.reps), due_on: String(x.due_on) }));
}

/** Row counts of a user in repertoires, repertoire_moves and cards. */
export async function countsOf(userId: string) {
  const one = async (t: string) => Number((await rows(sql`select count(*)::int as n from ${sql.raw(t)} where user_id = ${userId}`))[0].n);
  return { repertoires: await one('repertoires'), moves: await one('repertoire_moves'), cards: await one('cards') };
}

/** The state of an addMove result: `status` or the error code, whichever shape the module uses. */
export const outcomeOf = (r: any): string => r?.status ?? r?.error?.code ?? r?.error ?? r?.code;

/** The card ids of a user, with their state (ease read back as a number). */
export async function cardRowsOf(userId: string) {
  const r = await rows(sql`select id, ease, interval_days, reps, to_char(due_on, 'YYYY-MM-DD') as due_on from cards where user_id = ${userId} order by id`);
  return r.map((x) => ({ id: String(x.id), ease: Number(x.ease), interval_days: Number(x.interval_days), reps: Number(x.reps), due_on: String(x.due_on) }));
}
