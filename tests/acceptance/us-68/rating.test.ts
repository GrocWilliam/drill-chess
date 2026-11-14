// US-68: the rating block of getStats and pickSeries.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { addGame, daysBefore, newUser, query, scoreModule, seriesOf, statsModule } from '../support/stats-db';

let stats: Awaited<ReturnType<typeof statsModule>>;
const now = new Date();
const filters = (q = '') => stats.parseStatsFilters(query(q), now);
const t = (h: number) => new Date(now.getTime() - h * 3600_000 + 0 - (now.getTime() % 1000));
type Series = { site: string; time: string; points: { at: string; rating: number }[] };

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  stats = await statsModule();
});

describe('getStats: rating series', () => {
  it('chess.com blitz games as White 1500, as Black 1520, as White 1480 → points 1500, 1520, 1480 in ended_at order with ISO `at`', async () => {
    const u = await newUser();
    const [a, b, c] = [t(30), t(20), t(10)];
    // inserted out of order on purpose
    await addGame(u, { colour: 'white', result: 'win', endedAt: c, whiteRating: 1480, blackRating: 1600 });
    await addGame(u, { colour: 'white', result: 'win', endedAt: a, whiteRating: 1500, blackRating: 1400 });
    await addGame(u, { colour: 'black', result: 'win', endedAt: b, whiteRating: 1700, blackRating: 1520 });
    const s = await stats.getStats(u, filters());
    const series = (s.rating.series as Series[]).find((x) => x.site === 'chesscom' && x.time === 'blitz');
    expect(series).toBeDefined();
    expect(series!.points.map((p) => p.rating)).toEqual([1500, 1520, 1480]);
    expect(series!.points.map((p) => p.at)).toEqual([a.toISOString(), b.toISOString(), c.toISOString()]);
  });

  it('a game whose player rating is null is not a point of any series', async () => {
    const u = await newUser();
    await addGame(u, { colour: 'white', result: 'win', endedAt: t(3), whiteRating: null, blackRating: 1800 });
    await addGame(u, { colour: 'black', result: 'win', endedAt: t(2), whiteRating: 1800, blackRating: null });
    await addGame(u, { colour: 'white', result: 'win', endedAt: t(1), whiteRating: 1450, blackRating: null });
    const s = await stats.getStats(u, filters());
    const all = (s.rating.series as Series[]).flatMap((x) => x.points);
    expect(all.map((p) => p.rating)).toEqual([1450]);
  });

  it('a user with only null ratings has no series', async () => {
    const u = await newUser();
    await addGame(u, { colour: 'white', result: 'win', whiteRating: null });
    const s = await stats.getStats(u, filters());
    expect(s.rating.series).toEqual([]);
  });

  it('games in Lichess rapid, chess.com daily and chess.com blitz → series in the order chesscom-blitz, chesscom-daily, lichess-rapid', async () => {
    const u = await newUser();
    await addGame(u, { site: 'lichess', timeClass: 'rapid', colour: 'white', result: 'win', whiteRating: 1600 });
    await addGame(u, { site: 'chesscom', timeClass: 'daily', colour: 'white', result: 'win', whiteRating: 1500 });
    await addGame(u, { site: 'chesscom', timeClass: 'blitz', colour: 'white', result: 'win', whiteRating: 1400 });
    const s = await stats.getStats(u, filters());
    expect((s.rating.series as Series[]).map((x) => `${x.site}-${x.time}`)).toEqual([
      'chesscom-blitz', 'chesscom-daily', 'lichess-rapid',
    ]);
  });

  it('games 29 and 31 days old in the same series, period=30d → only the 29-day-old point', async () => {
    const u = await newUser();
    await addGame(u, { colour: 'white', result: 'win', endedAt: daysBefore(now, 31), whiteRating: 1300 });
    await addGame(u, { colour: 'white', result: 'win', endedAt: daysBefore(now, 29), whiteRating: 1350 });
    const s = await stats.getStats(u, filters('period=30d'));
    const series = s.rating.series as Series[];
    expect(series).toHaveLength(1);
    expect(series[0].points.map((p) => p.rating)).toEqual([1350]);
  });

  it('site=lichess → every series has site lichess', async () => {
    const u = await newUser();
    await addGame(u, { site: 'chesscom', timeClass: 'blitz', colour: 'white', result: 'win', whiteRating: 1400 });
    await addGame(u, { site: 'lichess', timeClass: 'blitz', colour: 'white', result: 'win', whiteRating: 1500 });
    await addGame(u, { site: 'lichess', timeClass: 'bullet', colour: 'white', result: 'win', whiteRating: 1550 });
    const s = await stats.getStats(u, filters('site=lichess'));
    const series = s.rating.series as Series[];
    expect(series.length).toBeGreaterThan(0);
    expect(series.every((x) => x.site === 'lichess')).toBe(true);
  });

  it('only the user’s own games make points', async () => {
    const u = await newUser();
    const other = await newUser();
    await addGame(u, { colour: 'white', result: 'win', whiteRating: 1111 });
    await addGame(other, { colour: 'white', result: 'win', whiteRating: 2222 });
    const s = await stats.getStats(u, filters());
    expect((s.rating.series as Series[]).flatMap((x) => x.points.map((p) => p.rating))).toEqual([1111]);
  });
});

describe('pickSeries', () => {
  it('series with 3, 5 and 2 points → 1', async () => {
    const { pickSeries } = await scoreModule();
    const s = [seriesOf('chesscom', 'blitz', 3), seriesOf('chesscom', 'rapid', 5), seriesOf('lichess', 'rapid', 2)];
    expect(pickSeries(s)).toBe(1);
  });

  it('chesscom-blitz (4 points) and lichess-bullet (4 points) → the index of chesscom-blitz', async () => {
    const { pickSeries } = await scoreModule();
    const s = [seriesOf('chesscom', 'blitz', 4), seriesOf('lichess', 'bullet', 4)];
    expect(pickSeries(s)).toBe(0);
  });

  it('the requested series wins; an absent or nonsense request gives the default', async () => {
    const { pickSeries } = await scoreModule();
    const s = [seriesOf('chesscom', 'blitz', 4), seriesOf('lichess', 'bullet', 4)];
    expect(pickSeries(s, 'lichess-bullet')).toBe(1);
    expect(pickSeries(s, 'chesscom-blitz')).toBe(0);
    expect(pickSeries(s, 'lichess-classical')).toBe(0);
    expect(pickSeries(s, 'nonsense')).toBe(0);
  });

  it('the requested series is picked even when another has more points', async () => {
    const { pickSeries } = await scoreModule();
    const s = [seriesOf('chesscom', 'blitz', 1), seriesOf('lichess', 'rapid', 9)];
    expect(pickSeries(s, 'chesscom-blitz')).toBe(0);
    expect(pickSeries(s)).toBe(1);
  });

  it('no series → -1', async () => {
    const { pickSeries } = await scoreModule();
    expect(pickSeries([])).toBe(-1);
    expect(pickSeries([], 'lichess-blitz')).toBe(-1);
  });
});
