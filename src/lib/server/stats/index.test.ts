import { beforeAll, describe, expect, it, vi } from 'vitest';

let stats: typeof import('./index');
let parse: typeof import('./filters').parseStatsFilters;
let db: typeof import('../db').db;
let gs: typeof import('../games/schema');
let users: typeof import('../accounts/schema').users;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  const dbm = await import('../db');
  db = dbm.db;
  await dbm.migrate();
  stats = await import('./index');
  ({ parseStatsFilters: parse } = await import('./filters'));
  gs = await import('../games/schema');
  ({ users } = await import('../accounts/schema'));
}, 120_000);

const now = new Date('2026-11-14T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600_000);

async function user() {
  const [u] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash: 'x' }).returning();
  return u.id;
}

type G = { site?: string; timeClass?: string; colour: string; result: string; endedAt?: Date };
async function game(userId: string, g: G, n = 1) {
  for (let i = 0; i < n; i++)
    await db.insert(gs.games).values({
      userId, site: g.site ?? 'chesscom', siteGameId: crypto.randomUUID(), url: 'https://example.test/g',
      endedAt: g.endedAt ?? daysAgo(1), timeClass: g.timeClass ?? 'blitz', clock: '180+2', colour: g.colour,
      result: g.result, whiteName: 'made_up_white', blackName: 'made_up_black', pgn: '1. e4 *', plies: 1,
    });
}

describe('getStats', () => {
  it('colour and time blocks, ordered, with scores; only the user’s games', async () => {
    const u = await user();
    const other = await user();
    await game(u, { colour: 'black', result: 'draw', timeClass: 'daily' }, 2);
    await game(u, { colour: 'white', result: 'win', timeClass: 'bullet' }, 3);
    await game(u, { colour: 'white', result: 'loss', timeClass: 'classical' });
    await game(other, { colour: 'white', result: 'win', timeClass: 'rapid' }, 4);
    const s = await stats.getStats(u, parse(new URLSearchParams(), now));
    expect(s.colour).toEqual([
      { colour: 'white', games: 4, wins: 3, draws: 0, losses: 1, score: 75 },
      { colour: 'black', games: 2, wins: 0, draws: 2, losses: 0, score: 50 },
    ]);
    expect(s.time).toEqual([
      { time: 'bullet', games: 3, wins: 3, draws: 0, losses: 0, score: 100 },
      { time: 'classical', games: 1, wins: 0, draws: 0, losses: 1, score: 0 },
      { time: 'daily', games: 2, wins: 0, draws: 2, losses: 0, score: 50 },
    ]);
  });

  it('site, time and period filters', async () => {
    const u = await user();
    await game(u, { site: 'lichess', timeClass: 'blitz', colour: 'white', result: 'win', endedAt: daysAgo(29) });
    await game(u, { site: 'lichess', timeClass: 'blitz', colour: 'black', result: 'loss', endedAt: daysAgo(31) });
    await game(u, { site: 'lichess', timeClass: 'rapid', colour: 'white', result: 'draw' });
    await game(u, { site: 'chesscom', timeClass: 'blitz', colour: 'white', result: 'win' });
    const total = (s: Awaited<ReturnType<typeof stats.getStats>>) => s.colour.reduce((n, r) => n + r.games, 0);
    const get = (q: string) => stats.getStats(u, parse(new URLSearchParams(q), now));
    expect(total(await get(''))).toBe(4);
    expect(total(await get('site=lichess'))).toBe(3);
    expect(total(await get('time=blitz'))).toBe(3);
    expect(total(await get('site=lichess&time=blitz'))).toBe(2);
    expect((await get('site=lichess&time=blitz&period=30d')).colour).toEqual([
      { colour: 'white', games: 1, wins: 1, draws: 0, losses: 0, score: 100 },
    ]);
  });

  it('a user with no game → empty blocks and placeholders', async () => {
    const zero = { inaccuracy: 0, mistake: 0, blunder: 0 };
    expect(await stats.getStats(await user(), parse(new URLSearchParams(), now))).toEqual({
      colour: [], time: [], openings: [], rating: { series: [] },
      mistakes: { games: 0, accuracy: null, byPhase: { opening: zero, middlegame: zero, endgame: zero } },
    });
  });

  it('openings: unknown group, tie-break, colour filter', async () => {
    const u = await user();
    const add = async (eco: string | null, opening: string | null, colour: string, result: string, n: number) => {
      for (let i = 0; i < n; i++)
        await db.insert(gs.games).values({
          userId: u, site: 'chesscom', siteGameId: crypto.randomUUID(), url: 'https://example.test/g', endedAt: daysAgo(1),
          timeClass: 'blitz', clock: '180+2', colour, result, whiteName: 'w', blackName: 'b', pgn: '1. e4 *', plies: 1, eco, opening,
        });
    };
    await add('B00', null, 'white', 'win', 2);
    await add(null, null, 'black', 'loss', 1);
    await add('C50', 'Italian Game', 'white', 'win', 2);
    await add('A00', 'Polish Opening', 'white', 'draw', 1);
    const both = (await stats.getStats(u, parse(new URLSearchParams(), now))).openings;
    expect(both.map((r) => [r.eco, r.opening, r.games])).toEqual([
      [null, null, 3], ['C50', 'Italian Game', 2], ['A00', 'Polish Opening', 1],
    ]);
    const black = (await stats.getStats(u, parse(new URLSearchParams('openingsColour=black'), now))).openings;
    expect(black).toHaveLength(1);
    expect(black[0].score).toBe(0);
  });
});
