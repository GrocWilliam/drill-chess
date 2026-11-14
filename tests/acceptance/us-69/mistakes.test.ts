// US-69: the `mistakes` block of getStats, through the stats module's function
// (Vitest on the process `db` with PGLITE_DATA_DIR=memory://; users, games and `analyses` rows inserted directly
// with chosen marks, phases and accuracies).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { addAnalysedGame, addGame, addGames, daysBefore, newUser, query, statsModule } from '../support/stats-db';

let stats: Awaited<ReturnType<typeof statsModule>>;
const now = new Date();
const getStats = (userId: string, q = '') => stats.getStats(userId, stats.parseStatsFilters(query(q), now));

const zero = { inaccuracy: 0, mistake: 0, blunder: 0 };
const allZero = { opening: zero, middlegame: zero, endgame: zero };

/** A 2-ply analysis with the given marks/phases. */
const plain = (marks: ('inaccuracy' | 'mistake' | 'blunder' | null)[], phase: 'opening' | 'middlegame' | 'endgame' = 'opening', acc = { w: 80, b: 60 }) => ({
  marks, phases: marks.map(() => phase), accuracyWhite: acc.w, accuracyBlack: acc.b,
});

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  stats = await statsModule();
});

describe('mistakes: the two analysed games A and B', () => {
  let s: Awaited<ReturnType<typeof getStats>>;
  beforeAll(async () => {
    const u = await newUser();
    // A: the user is White.
    await addAnalysedGame(u, { colour: 'white', result: 'win' }, {
      marks: [null, 'blunder', 'mistake', 'blunder', 'inaccuracy', null],
      phases: ['opening', 'opening', 'middlegame', 'middlegame', 'endgame', 'endgame'],
      accuracyWhite: 81.25, accuracyBlack: 40,
    });
    // B: the user is Black.
    await addAnalysedGame(u, { colour: 'black', result: 'loss' }, {
      marks: ['blunder', 'inaccuracy', null, 'blunder'],
      phases: ['opening', 'opening', 'opening', 'opening'],
      accuracyWhite: 30, accuracyBlack: 70,
    });
    s = await getStats(u);
  });

  it('mistakes.games is 2', () => {
    expect(s.mistakes.games).toBe(2);
  });

  it('accuracy is 75.6 (the player’s accuracies 81.25 and 70, averaged, one decimal)', () => {
    expect(s.mistakes.accuracy).toBe(75.6);
  });

  it('byPhase.opening is {inaccuracy 0.5, mistake 0, blunder 0.5}', () => {
    expect(s.mistakes.byPhase.opening).toEqual({ inaccuracy: 0.5, mistake: 0, blunder: 0.5 });
  });

  it('byPhase.middlegame is {inaccuracy 0, mistake 0.5, blunder 0}', () => {
    expect(s.mistakes.byPhase.middlegame).toEqual({ inaccuracy: 0, mistake: 0.5, blunder: 0 });
  });

  it('byPhase.endgame is {inaccuracy 0.5, mistake 0, blunder 0}', () => {
    expect(s.mistakes.byPhase.endgame).toEqual({ inaccuracy: 0.5, mistake: 0, blunder: 0 });
  });
});

describe('mistakes: only the player’s plies count', () => {
  it('one analysed game as White, all Black’s plies blunders and none of the user’s marked → games 1, every byPhase value 0', async () => {
    const u = await newUser();
    await addAnalysedGame(u, { colour: 'white', result: 'win' }, {
      marks: [null, 'blunder', null, 'blunder', null, 'blunder'],
      phases: ['opening', 'opening', 'middlegame', 'middlegame', 'endgame', 'endgame'],
      accuracyWhite: 99, accuracyBlack: 10,
    });
    const s = await getStats(u);
    expect(s.mistakes.games).toBe(1);
    expect(s.mistakes.byPhase).toEqual(allZero);
  });

  it('one analysed game as Black, all White’s plies blunders and none of the user’s marked → every byPhase value 0', async () => {
    const u = await newUser();
    await addAnalysedGame(u, { colour: 'black', result: 'win' }, {
      marks: ['blunder', null, 'blunder', null, 'blunder'],
      phases: ['opening', 'opening', 'middlegame', 'middlegame', 'endgame'],
      accuracyWhite: 10, accuracyBlack: 99,
    });
    const s = await getStats(u);
    expect(s.mistakes.games).toBe(1);
    expect(s.mistakes.byPhase).toEqual(allZero);
  });
});

describe('mistakes: divided by all analysed games', () => {
  it('3 analysed games with one player blunder in the middlegame in total → byPhase.middlegame.blunder is 0.3', async () => {
    const u = await newUser();
    await addAnalysedGame(u, { colour: 'white', result: 'loss' }, plain(['blunder', null], 'middlegame'));
    await addAnalysedGame(u, { colour: 'white', result: 'win' }, plain([null, null], 'opening'));
    await addAnalysedGame(u, { colour: 'black', result: 'draw' }, plain([null, null], 'opening'));
    const s = await getStats(u);
    expect(s.mistakes.games).toBe(3);
    expect(s.mistakes.byPhase.middlegame.blunder).toBe(0.3);
  });
});

describe('mistakes: only analysed games', () => {
  it('a user with 4 games of which 1 is analysed → mistakes.games is 1', async () => {
    const u = await newUser();
    await addGames(u, 3, { colour: 'white', result: 'win' });
    await addAnalysedGame(u, { colour: 'black', result: 'loss' }, plain([null, 'mistake']));
    const s = await getStats(u);
    expect(s.mistakes.games).toBe(1);
    expect(s.mistakes.byPhase.opening.mistake).toBe(1);
  });

  it('another user’s analysed games are not counted', async () => {
    const u = await newUser();
    const other = await newUser();
    await addAnalysedGame(u, { colour: 'white', result: 'win' }, plain([null, null], 'opening', { w: 90, b: 10 }));
    await addAnalysedGame(other, { colour: 'white', result: 'win' }, plain(['blunder', null], 'opening', { w: 20, b: 10 }));
    const s = await getStats(u);
    expect(s.mistakes.games).toBe(1);
    expect(s.mistakes.accuracy).toBe(90);
    expect(s.mistakes.byPhase.opening.blunder).toBe(0);
  });
});

describe('mistakes: filters', () => {
  let u: string;
  beforeAll(async () => {
    u = await newUser();
    // chess.com, blitz: user White, a blunder in the opening, accuracy 60.
    await addAnalysedGame(u, { site: 'chesscom', timeClass: 'blitz', colour: 'white', result: 'loss' },
      plain(['blunder', null], 'opening', { w: 60, b: 90 }));
    // chess.com, rapid: user Black, a mistake in the endgame, accuracy 70.
    await addAnalysedGame(u, { site: 'chesscom', timeClass: 'rapid', colour: 'black', result: 'win' },
      plain([null, 'mistake'], 'endgame', { w: 50, b: 70 }));
    // Lichess, blitz: user Black, an inaccuracy in the middlegame, accuracy 80.
    await addAnalysedGame(u, { site: 'lichess', timeClass: 'blitz', colour: 'black', result: 'draw' },
      plain([null, 'inaccuracy'], 'middlegame', { w: 40, b: 80 }));
    // Lichess, rapid, not analysed.
    await addGame(u, { site: 'lichess', timeClass: 'rapid', colour: 'white', result: 'win' });
  });

  it('site=lichess: mistakes covers only the analysed Lichess games', async () => {
    const s = await getStats(u, 'site=lichess');
    expect(s.mistakes).toEqual({
      games: 1,
      accuracy: 80,
      byPhase: { opening: zero, middlegame: { inaccuracy: 1, mistake: 0, blunder: 0 }, endgame: zero },
    });
  });

  it('site=chesscom: mistakes covers only the analysed chess.com games', async () => {
    const s = await getStats(u, 'site=chesscom');
    expect(s.mistakes).toEqual({
      games: 2,
      accuracy: 65,
      byPhase: {
        opening: { inaccuracy: 0, mistake: 0, blunder: 0.5 },
        middlegame: zero,
        endgame: { inaccuracy: 0, mistake: 0.5, blunder: 0 },
      },
    });
  });

  it('time=blitz: mistakes covers only the analysed blitz games', async () => {
    const s = await getStats(u, 'time=blitz');
    expect(s.mistakes.games).toBe(2);
    expect(s.mistakes.accuracy).toBe(70);
    expect(s.mistakes.byPhase.endgame).toEqual(zero);
  });

  it('openingsColour does not apply: openingsColour=white gives the same mistakes as no filter', async () => {
    const plainStats = await getStats(u);
    const white = await getStats(u, 'openingsColour=white');
    expect(plainStats.mistakes.games).toBe(3);
    expect(white.mistakes).toEqual(plainStats.mistakes);
  });
});

describe('mistakes: period', () => {
  it('an analysed game 31 days old is not counted with period=30d (a 29-day-old one is), and is with period=all', async () => {
    const u = await newUser();
    await addAnalysedGame(u, { colour: 'white', result: 'win', endedAt: daysBefore(now, 29) },
      plain([null, null], 'opening', { w: 90, b: 10 }));
    await addAnalysedGame(u, { colour: 'white', result: 'loss', endedAt: daysBefore(now, 31) },
      plain(['blunder', null], 'opening', { w: 50, b: 10 }));
    const recent = await getStats(u, 'period=30d');
    expect(recent.mistakes.games).toBe(1);
    expect(recent.mistakes.accuracy).toBe(90);
    expect(recent.mistakes.byPhase.opening.blunder).toBe(0);
    const all = await getStats(u, 'period=all');
    expect(all.mistakes.games).toBe(2);
  });
});

describe('mistakes: no analysed game', () => {
  it('a user with games but no analysed game → mistakes is {games: 0, accuracy: null, byPhase: all 0}', async () => {
    const u = await newUser();
    await addGames(u, 2, { colour: 'white', result: 'win' });
    const s = await getStats(u);
    expect(s.mistakes).toEqual({ games: 0, accuracy: null, byPhase: allZero });
  });

  it('analysed games outside the filters only → mistakes is {games: 0, accuracy: null, byPhase: all 0}', async () => {
    const u = await newUser();
    await addAnalysedGame(u, { site: 'chesscom', colour: 'white', result: 'win' }, plain(['blunder', null]));
    const s = await getStats(u, 'site=lichess');
    expect(s.mistakes).toEqual({ games: 0, accuracy: null, byPhase: allZero });
  });
});
