// US-67: the openings block of getStats (Vitest on the process `db` with PGLITE_DATA_DIR=memory://).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { addGames, daysBefore, newUser, query, statsModule } from '../support/stats-db';

let stats: Awaited<ReturnType<typeof statsModule>>;
const now = new Date();
const filters = (q = '') => stats.parseStatsFilters(query(q), now);

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  stats = await statsModule();
});

type Row = { eco: string | null; opening: string | null; games: number; wins: number; draws: number; losses: number; score: number };
const key = (r: Row) => `${r.eco} ${r.opening}`;

describe('top-10 openings', () => {
  it('12 groups holding 12, 11, …, 1 games → exactly 10 rows, 12 games down to 3, in that order', async () => {
    const u = await newUser();
    for (let i = 0; i < 12; i++) {
      await addGames(u, 12 - i, {
        colour: 'white', result: 'win', eco: `A${String(i).padStart(2, '0')}`, opening: `Opening ${i}`,
      });
    }
    const s = await stats.getStats(u, filters());
    expect(s.openings.map((r: Row) => r.games)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });

  it('groups of 3 games with scores 1, 2/3, 2/3, 2/3 → C50, A00, B20, D00 (ties broken by eco ascending)', async () => {
    const u = await newUser();
    const g = (eco: string, opening: string, w: number, d: number, l: number) =>
      Promise.all([
        addGames(u, w, { colour: 'white', result: 'win', eco, opening }),
        addGames(u, d, { colour: 'white', result: 'draw', eco, opening }),
        addGames(u, l, { colour: 'white', result: 'loss', eco, opening }),
      ]);
    await g('B20', 'Sicilian Defence', 2, 0, 1);
    await g('C50', 'Italian Game', 3, 0, 0);
    await g('A00', 'Polish Opening', 1, 2, 0);
    await g('D00', "Queen's Pawn Game", 1, 2, 0);
    const s = await stats.getStats(u, filters());
    expect(s.openings.map((r: Row) => r.eco)).toEqual(['C50', 'A00', 'B20', 'D00']);
    expect(s.openings.map((r: Row) => r.opening)).toEqual(['Italian Game', 'Polish Opening', 'Sicilian Defence', "Queen's Pawn Game"]);
  });

  it('every game without an opening falls in one group {eco: null, opening: null}, whatever its eco', async () => {
    const u = await newUser();
    await addGames(u, 2, { colour: 'white', result: 'win', eco: 'B00', opening: null });
    await addGames(u, 1, { colour: 'white', result: 'loss', eco: null, opening: null });
    await addGames(u, 2, { colour: 'white', result: 'win', eco: 'C50', opening: 'Italian Game' });
    const s = await stats.getStats(u, filters());
    expect(s.openings.find((r: Row) => r.eco === null && r.opening === null)).toMatchObject({
      eco: null, opening: null, games: 3, wins: 2, draws: 0, losses: 1, score: 67,
    });
    expect(s.openings.find((r: Row) => r.eco === 'C50')).toMatchObject({ eco: 'C50', opening: 'Italian Game', games: 2 });
    expect(s.openings.some((r: Row) => r.eco === 'B00')).toBe(false);
  });

  it('10 named groups of 5 games and 4 games with no opening → no row with opening null', async () => {
    const u = await newUser();
    for (let i = 0; i < 10; i++) {
      await addGames(u, 5, { colour: 'white', result: 'win', eco: `E${String(i).padStart(2, '0')}`, opening: `Named ${i}` });
    }
    await addGames(u, 4, { colour: 'white', result: 'win', eco: null, opening: null });
    const s = await stats.getStats(u, filters());
    expect(s.openings).toHaveLength(10);
    expect(s.openings.some((r: Row) => r.opening === null)).toBe(false);
  });
});

describe('openingsColour', () => {
  it('3 Italian games as White (2 wins, 1 draw) and 2 as Black (2 losses) → both, white, black rows; colour unchanged', async () => {
    const u = await newUser();
    const it_ = { eco: 'C50', opening: 'Italian Game' };
    await addGames(u, 2, { colour: 'white', result: 'win', ...it_ });
    await addGames(u, 1, { colour: 'white', result: 'draw', ...it_ });
    await addGames(u, 2, { colour: 'black', result: 'loss', ...it_ });
    const both = await stats.getStats(u, filters('openingsColour=both'));
    const white = await stats.getStats(u, filters('openingsColour=white'));
    const black = await stats.getStats(u, filters('openingsColour=black'));
    const row = (s: { openings: Row[] }) => s.openings.find((r) => key(r) === 'C50 Italian Game');
    expect(row(both)).toMatchObject({ games: 5, wins: 2, draws: 1, losses: 2, score: 50 });
    expect(row(white)).toMatchObject({ games: 3, wins: 2, draws: 1, losses: 0, score: 83 });
    expect(row(black)).toMatchObject({ games: 2, wins: 0, losses: 2, score: 0 });
    expect(white.colour).toEqual(both.colour);
    expect(black.colour).toEqual(both.colour);
    expect(white.time).toEqual(both.time);
    expect(black.time).toEqual(both.time);
  });
});

describe('time and period filters', () => {
  it('openings in blitz and in rapid, time=blitz → the counts cover only blitz games', async () => {
    const u = await newUser();
    const o = { eco: 'C50', opening: 'Italian Game', colour: 'white' as const, result: 'win' as const };
    await addGames(u, 3, { ...o, timeClass: 'blitz' });
    await addGames(u, 4, { ...o, timeClass: 'rapid' });
    const s = await stats.getStats(u, filters('time=blitz'));
    expect(s.openings).toHaveLength(1);
    expect(s.openings[0]).toMatchObject({ eco: 'C50', games: 3, wins: 3 });
  });

  it('site and period apply to the openings too', async () => {
    const u = await newUser();
    const o = { eco: 'B20', opening: 'Sicilian Defence', colour: 'white' as const, result: 'win' as const };
    await addGames(u, 2, { ...o, site: 'lichess' });
    await addGames(u, 3, { ...o, site: 'chesscom' });
    await addGames(u, 4, { ...o, site: 'lichess', endedAt: daysBefore(now, 100) });
    expect((await stats.getStats(u, filters('site=lichess&period=30d'))).openings[0]).toMatchObject({ games: 2 });
    expect((await stats.getStats(u, filters('site=lichess'))).openings[0]).toMatchObject({ games: 6 });
  });

  it("another user's games are not counted", async () => {
    const u = await newUser();
    const other = await newUser();
    await addGames(other, 3, { colour: 'white', result: 'win', eco: 'C50', opening: 'Italian Game' });
    expect((await stats.getStats(u, filters())).openings).toEqual([]);
  });
});
