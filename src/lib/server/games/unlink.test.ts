import { beforeAll, describe, expect, it, vi } from 'vitest';

let g: typeof import('./index');
let db: typeof import('../db').db;
let users: typeof import('../accounts/schema').users;
let s: typeof import('./schema');

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  ({ db } = await import('../db'));
  await (await import('../db')).migrate();
  g = await import('./index');
  ({ users } = await import('../accounts/schema'));
  s = await import('./schema');
}, 120_000);

const setup = async (status: string) => {
  const [{ id }] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash: 'x' }).returning();
  for (const site of ['chesscom', 'lichess']) {
    await db.insert(s.linkedAccounts).values({ userId: id, site, username: 'someone' });
    await db.insert(s.importJobs).values({ userId: id, site, status: site === 'chesscom' ? status : 'done' });
    await db.insert(s.games).values({
      userId: id, site, siteGameId: '1', url: 'u', endedAt: new Date(), timeClass: 'blitz', clock: '', colour: 'white',
      result: 'win', whiteName: 'a', blackName: 'b', pgn: '1. e4 *', plies: 1,
    });
  }
  return id;
};

describe('unlinkAccount', () => {
  it('deletes that site only', async () => {
    const id = await setup('done');
    expect(await g.unlinkAccount(id, 'chesscom')).toBe('ok');
    expect((await g.listLinkedAccounts(id)).map((a) => a.site)).toEqual(['lichess']);
    expect((await g.listGames(id)).games.map((x) => x.site)).toEqual(['lichess']);
    expect((await g.importStatus(id)).map((j) => j.site)).toEqual(['lichess']);
  });
  it('refuses while a job is active and deletes nothing', async () => {
    const id = await setup('running');
    expect(await g.unlinkAccount(id, 'chesscom')).toBe('import_running');
    expect(await g.listLinkedAccounts(id)).toHaveLength(2);
    expect((await g.listGames(id)).games).toHaveLength(2);
  });
});
