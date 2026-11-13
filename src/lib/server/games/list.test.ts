import { beforeAll, describe, expect, it, vi } from 'vitest';

let m: typeof import('./index');
let db: typeof import('../db').db;
let users: typeof import('../accounts/schema').users;
let games: typeof import('./schema').games;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  ({ db } = await import('../db'));
  await (await import('../db')).migrate();
  m = await import('./index');
  ({ users } = await import('../accounts/schema'));
  ({ games } = await import('./schema'));
}, 120_000);

const newUser = async () =>
  (await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash: 'x' }).returning())[0].id;

const row = (userId: string, n: number) => ({
  userId, site: 'chesscom', siteGameId: String(n), url: `https://example.test/${n}`, endedAt: new Date(Date.UTC(2026, 0, 1, n)),
  timeClass: 'blitz', clock: '180+2', colour: 'white', result: 'win', whiteName: 'a', blackName: 'b', pgn: '1. e4 e5', plies: 2,
});

describe('listGames / getGame', () => {
  it('lists newest first, only the user\'s, 50 per page', async () => {
    const u = await newUser();
    const other = await newUser();
    await db.insert(games).values([...Array.from({ length: 51 }, (_, i) => row(u, i)), row(other, 99)]);
    const p1 = await m.listGames(u, {}, 1);
    expect(p1.games).toHaveLength(50);
    expect(p1.hasNext).toBe(true);
    expect(p1.games[0].siteGameId).toBe('50');
    const p2 = await m.listGames(u, {}, 2);
    expect(p2.games.map((g) => g.siteGameId)).toEqual(['0']);
    expect(p2.hasNext).toBe(false);
  });

  it('getGame returns null for another user, unknown and non-UUID ids', async () => {
    const u = await newUser();
    const other = await newUser();
    await db.insert(games).values(row(u, 1));
    const { games: [g] } = await m.listGames(u);
    expect((await m.getGame(u, g.id))?.id).toBe(g.id);
    expect(await m.getGame(other, g.id)).toBeNull();
    expect(await m.getGame(u, '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await m.getGame(u, 'abc')).toBeNull();
  });

  it('movesText strips headers and comments', () => {
    expect(m.movesText('[A "b"]\n[C "d"]\n\n1. e4 {[%clk 0:03]} c5\n2. Nf3 *\n')).toBe('1. e4 c5 2. Nf3 *');
  });
});
