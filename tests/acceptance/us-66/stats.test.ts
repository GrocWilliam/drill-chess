// US-66: getStats through the stats module's function
// (Vitest on the process `db` with PGLITE_DATA_DIR=memory://, users and games inserted directly).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  addAnalysis, addGame, addGames, allGameAndAnalysisRows, daysBefore, newUser, query, statsModule,
} from '../support/stats-db';

let stats: Awaited<ReturnType<typeof statsModule>>;
const now = new Date();
const allTime = () => stats.parseStatsFilters(query(''), now);

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  stats = await statsModule();
});

describe('getStats: colour block', () => {
  it('5 games as White (3 wins, 1 draw, 1 loss) and 4 as Black (2 draws, 2 losses) → exactly the white then black rows', async () => {
    const u = await newUser();
    await addGames(u, 3, { colour: 'white', result: 'win' });
    await addGames(u, 1, { colour: 'white', result: 'draw' });
    await addGames(u, 1, { colour: 'white', result: 'loss' });
    await addGames(u, 2, { colour: 'black', result: 'draw' });
    await addGames(u, 2, { colour: 'black', result: 'loss' });
    const s = await stats.getStats(u, allTime());
    expect(s.colour).toEqual([
      { colour: 'white', games: 5, wins: 3, draws: 1, losses: 1, score: 70 },
      { colour: 'black', games: 4, wins: 0, draws: 2, losses: 2, score: 25 },
    ]);
  });

  it('a user whose games are all as Black → one row, black', async () => {
    const u = await newUser();
    await addGames(u, 2, { colour: 'black', result: 'win' });
    await addGames(u, 1, { colour: 'black', result: 'loss' });
    const s = await stats.getStats(u, allTime());
    expect(s.colour).toHaveLength(1);
    expect(s.colour[0]).toEqual({ colour: 'black', games: 3, wins: 2, draws: 0, losses: 1, score: 67 });
  });
});

describe('getStats: time block', () => {
  it('games in daily, blitz and bullet → exactly bullet, blitz, daily in that order, each with its counts and score', async () => {
    const u = await newUser();
    await addGames(u, 2, { timeClass: 'daily', colour: 'white', result: 'win' });
    await addGames(u, 1, { timeClass: 'daily', colour: 'black', result: 'draw' });
    await addGames(u, 1, { timeClass: 'blitz', colour: 'white', result: 'loss' });
    await addGames(u, 3, { timeClass: 'blitz', colour: 'black', result: 'win' });
    await addGames(u, 1, { timeClass: 'bullet', colour: 'black', result: 'draw' });
    await addGames(u, 1, { timeClass: 'bullet', colour: 'white', result: 'loss' });
    const s = await stats.getStats(u, allTime());
    expect(s.time.map((r: { time: string }) => r.time)).toEqual(['bullet', 'blitz', 'daily']);
    expect(s.time[0]).toMatchObject({ time: 'bullet', games: 2, wins: 0, draws: 1, losses: 1, score: 25 });
    expect(s.time[1]).toMatchObject({ time: 'blitz', games: 4, wins: 3, draws: 0, losses: 1, score: 75 });
    expect(s.time[2]).toMatchObject({ time: 'daily', games: 3, wins: 2, draws: 1, losses: 0, score: 83 });
  });
});

describe('getStats: only the user’s games', () => {
  it('given two users with games, getStats for the first counts no game of the second', async () => {
    const first = await newUser();
    const second = await newUser();
    await addGames(first, 2, { timeClass: 'blitz', colour: 'white', result: 'win' });
    await addGames(second, 4, { timeClass: 'blitz', colour: 'white', result: 'loss' });
    await addGames(second, 3, { timeClass: 'rapid', colour: 'black', result: 'draw' });
    const s = await stats.getStats(first, allTime());
    expect(s.colour).toEqual([{ colour: 'white', games: 2, wins: 2, draws: 0, losses: 0, score: 100 }]);
    expect(s.time).toEqual([{ time: 'blitz', games: 2, wins: 2, draws: 0, losses: 0, score: 100 }]);
  });
});

describe('getStats: site and time filters', () => {
  let u: string;
  beforeAll(async () => {
    u = await newUser();
    await addGame(u, { site: 'chesscom', timeClass: 'blitz', colour: 'white', result: 'win' });
    await addGame(u, { site: 'chesscom', timeClass: 'blitz', colour: 'white', result: 'loss' });
    await addGame(u, { site: 'chesscom', timeClass: 'rapid', colour: 'black', result: 'draw' });
    await addGame(u, { site: 'chesscom', timeClass: 'bullet', colour: 'white', result: 'win' });
    await addGame(u, { site: 'lichess', timeClass: 'blitz', colour: 'black', result: 'win' });
    await addGame(u, { site: 'lichess', timeClass: 'blitz', colour: 'black', result: 'draw' });
    await addGame(u, { site: 'lichess', timeClass: 'rapid', colour: 'white', result: 'loss' });
    await addGame(u, { site: 'lichess', timeClass: 'blitz', colour: 'white', result: 'win' });
  });

  it('site=lichess: every count covers only the Lichess games', async () => {
    const s = await stats.getStats(u, stats.parseStatsFilters(query('site=lichess'), now));
    expect(s.colour).toEqual([
      { colour: 'white', games: 2, wins: 1, draws: 0, losses: 1, score: 50 },
      { colour: 'black', games: 2, wins: 1, draws: 1, losses: 0, score: 75 },
    ]);
    expect(s.time).toEqual([
      { time: 'blitz', games: 3, wins: 2, draws: 1, losses: 0, score: 83 },
      { time: 'rapid', games: 1, wins: 0, draws: 0, losses: 1, score: 0 },
    ]);
  });

  it('time=blitz: every count covers only the blitz games', async () => {
    const s = await stats.getStats(u, stats.parseStatsFilters(query('time=blitz'), now));
    expect(s.colour).toEqual([
      { colour: 'white', games: 3, wins: 2, draws: 0, losses: 1, score: 67 },
      { colour: 'black', games: 2, wins: 1, draws: 1, losses: 0, score: 75 },
    ]);
    expect(s.time).toEqual([{ time: 'blitz', games: 5, wins: 3, draws: 1, losses: 1, score: 70 }]);
  });

  it('site=lichess and time=blitz together: every count covers only the Lichess blitz games', async () => {
    const s = await stats.getStats(u, stats.parseStatsFilters(query('site=lichess&time=blitz'), now));
    expect(s.colour).toEqual([
      { colour: 'white', games: 1, wins: 1, draws: 0, losses: 0, score: 100 },
      { colour: 'black', games: 2, wins: 1, draws: 1, losses: 0, score: 75 },
    ]);
    expect(s.time).toEqual([{ time: 'blitz', games: 3, wins: 2, draws: 1, losses: 0, score: 83 }]);
  });
});

describe('getStats: period', () => {
  it('games ended 29 and 31 days before now: period=30d counts only the 29-day-old game, period=all both', async () => {
    const u = await newUser();
    await addGame(u, { colour: 'white', result: 'win', endedAt: daysBefore(now, 29) });
    await addGame(u, { colour: 'black', result: 'loss', endedAt: daysBefore(now, 31) });
    const recent = await stats.getStats(u, stats.parseStatsFilters(query('period=30d'), now));
    expect(recent.colour).toEqual([{ colour: 'white', games: 1, wins: 1, draws: 0, losses: 0, score: 100 }]);
    expect(recent.time).toEqual([{ time: 'blitz', games: 1, wins: 1, draws: 0, losses: 0, score: 100 }]);
    const all = await stats.getStats(u, stats.parseStatsFilters(query('period=all'), now));
    expect(all.colour).toEqual([
      { colour: 'white', games: 1, wins: 1, draws: 0, losses: 0, score: 100 },
      { colour: 'black', games: 1, wins: 0, draws: 0, losses: 1, score: 0 },
    ]);
  });

  it('a game ended exactly at since (now − 30 × 24 h) counts for period=30d', async () => {
    const u = await newUser();
    await addGame(u, { colour: 'white', result: 'draw', endedAt: daysBefore(now, 30) });
    const s = await stats.getStats(u, stats.parseStatsFilters(query('period=30d'), now));
    expect(s.colour).toEqual([{ colour: 'white', games: 1, wins: 0, draws: 1, losses: 0, score: 50 }]);
  });
});

describe('getStats: a user with no game', () => {
  it('→ exactly empty colour, time and openings, rating {series: []}, mistakes with 0 games, null accuracy and zero marks per phase', async () => {
    const u = await newUser();
    const other = await newUser();
    await addGames(other, 2, { colour: 'white', result: 'win' });
    const zero = { inaccuracy: 0, mistake: 0, blunder: 0 };
    expect(await stats.getStats(u, allTime())).toEqual({
      colour: [],
      time: [],
      openings: [],
      rating: { series: [] },
      mistakes: { games: 0, accuracy: null, byPhase: { opening: zero, middlegame: zero, endgame: zero } },
    });
  });
});

describe('getStats is read only', () => {
  it('no row of games or analyses changes after getStats with any filters', async () => {
    const u = await newUser();
    const g1 = await addGame(u, { site: 'lichess', timeClass: 'rapid', colour: 'white', result: 'win' });
    await addGame(u, { site: 'chesscom', timeClass: 'blitz', colour: 'black', result: 'loss', endedAt: daysBefore(now, 100) });
    await addAnalysis(u, g1);
    const before = await allGameAndAnalysisRows();
    for (const q of ['', 'site=lichess', 'time=blitz&period=90d', 'period=365d&openingsColour=white', 'site=foo&time=hyper']) {
      await stats.getStats(u, stats.parseStatsFilters(query(q), now));
    }
    expect(await allGameAndAnalysisRows()).toEqual(before);
    expect(before.analyses.length).toBeGreaterThan(0);
  });
});
