import { beforeAll, describe, expect, it, vi } from 'vitest';

let stats: typeof import('./index');
let parse: typeof import('./filters').parseStatsFilters;
let db: typeof import('../db').db;
let gs: typeof import('../games/schema');
let users: typeof import('../accounts/schema').users;
let analyses: typeof import('../review/schema').analyses;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  const dbm = await import('../db');
  db = dbm.db;
  await dbm.migrate();
  stats = await import('./index');
  ({ parseStatsFilters: parse } = await import('./filters'));
  gs = await import('../games/schema');
  ({ users } = await import('../accounts/schema'));
  ({ analyses } = await import('../review/schema'));
}, 120_000);

const now = new Date('2026-11-14T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600_000);

async function user() {
  const [u] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash: 'x' }).returning();
  return u.id;
}

type G = { site?: string; timeClass?: string; colour: string; result: string; endedAt?: Date };
async function game(userId: string, g: G, n = 1) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const [row] = await db.insert(gs.games).values({
      userId, site: g.site ?? 'chesscom', siteGameId: crypto.randomUUID(), url: 'https://example.test/g',
      endedAt: g.endedAt ?? daysAgo(1), timeClass: g.timeClass ?? 'blitz', clock: '180+2', colour: g.colour,
      result: g.result, whiteName: 'made_up_white', blackName: 'made_up_black', pgn: '1. e4 *', plies: 1,
    }).returning();
    ids.push(row.id);
  }
  return ids;
}

type Mark = 'inaccuracy' | 'mistake' | 'blunder' | null;
type Ph = 'opening' | 'middlegame' | 'endgame';
type A = { marks: Mark[]; phases: Ph[]; w: number; b: number };
const row = (userId: string, gameId: string, a: A) => ({
  gameId, userId, depth: 6, evals: a.marks.map(() => ({ cp: 0 })).concat([{ cp: 0 }]), best: a.marks.map(() => null),
  marks: a.marks, phases: a.phases, accuracyWhite: a.w, accuracyBlack: a.b,
});
async function analysed(userId: string, g: G, a: A) {
  const [id] = await game(userId, g);
  await db.insert(analyses).values(row(userId, id, a));
}
const zero = { inaccuracy: 0, mistake: 0, blunder: 0 };

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

describe('getStats mistakes', () => {
  const get = (u: string, q = '') => stats.getStats(u, parse(new URLSearchParams(q), now));

  it('only the player’s plies, per phase, divided by the analysed games; average player accuracy', async () => {
    const u = await user();
    await analysed(u, { colour: 'white', result: 'win' }, {
      marks: [null, 'blunder', 'mistake', 'blunder', 'inaccuracy', null],
      phases: ['opening', 'opening', 'middlegame', 'middlegame', 'endgame', 'endgame'], w: 81.25, b: 40,
    });
    await analysed(u, { colour: 'black', result: 'loss' }, {
      marks: ['blunder', 'inaccuracy', null, 'blunder'], phases: ['opening', 'opening', 'opening', 'opening'], w: 30, b: 70,
    });
    await game(u, { colour: 'white', result: 'draw' }, 2);
    expect((await get(u)).mistakes).toEqual({
      games: 2,
      accuracy: 75.6,
      byPhase: {
        opening: { inaccuracy: 0.5, mistake: 0, blunder: 0.5 },
        middlegame: { inaccuracy: 0, mistake: 0.5, blunder: 0 },
        endgame: { inaccuracy: 0.5, mistake: 0, blunder: 0 },
      },
    });
  });

  it('rounds to one decimal, applies site and period, ignores other users', async () => {
    const u = await user();
    const other = await user();
    await analysed(u, { colour: 'white', result: 'loss' }, { marks: ['blunder', null], phases: ['middlegame', 'middlegame'], w: 50, b: 50 });
    await analysed(u, { colour: 'white', result: 'win' }, { marks: [null, null], phases: ['opening', 'opening'], w: 50, b: 50 });
    await analysed(u, { colour: 'black', result: 'win' }, { marks: [null, null], phases: ['opening', 'opening'], w: 50, b: 50 });
    await analysed(u, { site: 'lichess', colour: 'black', result: 'win', endedAt: daysAgo(31) },
      { marks: [null, 'mistake'], phases: ['endgame', 'endgame'], w: 10, b: 91.4 });
    await analysed(other, { colour: 'white', result: 'win' }, { marks: ['blunder', null], phases: ['opening', 'opening'], w: 1, b: 1 });
    const s = (await get(u, 'site=chesscom')).mistakes;
    expect(s.games).toBe(3);
    expect(s.byPhase.middlegame.blunder).toBe(0.3);
    expect(s.byPhase.opening).toEqual(zero);
    expect((await get(u, 'site=lichess')).mistakes).toMatchObject({ games: 1, accuracy: 91.4 });
    expect((await get(u, 'site=lichess&period=30d')).mistakes).toEqual({
      games: 0, accuracy: null, byPhase: { opening: zero, middlegame: zero, endgame: zero },
    });
  });
});

describe('getStats performance', () => {
  let u: string;
  beforeAll(async () => {
    u = await user();
    const marks = Array.from({ length: 60 }, (_, i) => ([null, 'inaccuracy', null, 'mistake', null, 'blunder'] as const)[i % 6]);
    const phases = Array.from({ length: 60 }, (_, i): Ph => (i < 20 ? 'opening' : i < 40 ? 'middlegame' : 'endgame'));
    const times = ['bullet', 'blitz', 'rapid', 'classical', 'daily'];
    const insert = async (userId: string, n: number) => {
      const ids: string[] = [];
      for (let i = 0; i < n; i += 500) {
        const rows = Array.from({ length: Math.min(500, n - i) }, (_, k) => {
          const j = i + k;
          return {
            userId, site: j % 2 ? 'lichess' : 'chesscom', siteGameId: crypto.randomUUID(), url: 'https://example.test/g',
            endedAt: new Date(now.getTime() - j * 3600_000), timeClass: times[j % 5], clock: '180+2',
            colour: j % 2 ? 'black' : 'white', result: ['win', 'draw', 'loss'][j % 3],
            whiteName: 'made_up_white', blackName: 'made_up_black', pgn: '1. e4 *', plies: 60,
          };
        });
        ids.push(...(await db.insert(gs.games).values(rows).returning({ id: gs.games.id })).map((r) => r.id));
      }
      return ids;
    };
    const ids = await insert(u, 5000);
    const a = { marks: [...marks], phases, w: 80, b: 70 };
    for (let i = 0; i < 1000; i += 200)
      await db.insert(analyses).values(ids.slice(i, i + 200).map((id) => row(u, id, a)));
    await insert(await user(), 100);
  }, 120_000);

  it('5,000 games and 1,000 analyses of 60 plies: getStats answers in under 1 s after a warm-up', async () => {
    const run = () => stats.getStats(u, parse(new URLSearchParams(), now));
    const warm = await run();
    expect(warm.mistakes.games).toBe(1000);
    // Alternating colours: White games (even j) see marks at even indexes = null; Black games see the odd ones.
    expect(warm.mistakes.accuracy).toBe(75);
    // Fastest of 3 timed calls: `make test` also runs inside acceptance tests on loaded CI hosts, where one
    // descheduled call can pass 1 s while the query itself takes ~100 ms.
    let best = Infinity;
    for (let k = 0; k < 3; k++) {
      const t0 = performance.now();
      await run();
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(1000);
  });
});
