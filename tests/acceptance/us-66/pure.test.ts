// US-66: the pure functions of the stats module: parseStatsFilters (filters.ts) and scorePercent (score.ts).
import { describe, expect, it } from 'vitest';
import { filtersModule, query, scoreModule } from '../support/stats-db';

const now = new Date();

describe('parseStatsFilters', () => {
  it('given now = 2026-11-14T12:00:00Z, site=lichess&time=blitz&period=90d&openingsColour=black → lichess, blitz, 90d, since 2026-08-16T12:00:00Z, black', async () => {
    const { parseStatsFilters } = await filtersModule();
    const f = parseStatsFilters(query('site=lichess&time=blitz&period=90d&openingsColour=black'), new Date('2026-11-14T12:00:00Z'));
    expect(f.site).toBe('lichess');
    expect(f.timeClass).toBe('blitz');
    expect(f.period).toBe('90d');
    expect(f.since).toBeInstanceOf(Date);
    expect(f.since?.toISOString()).toBe('2026-08-16T12:00:00.000Z');
    expect(f.openingsColour).toBe('black');
  });

  it('since is now − 30 × 24 h for 30d and now − 365 × 24 h for 365d', async () => {
    const { parseStatsFilters } = await filtersModule();
    const at = new Date('2026-11-14T12:00:00Z');
    expect(parseStatsFilters(query('period=30d'), at).since?.toISOString()).toBe('2026-10-15T12:00:00.000Z');
    expect(parseStatsFilters(query('period=365d'), at).since?.toISOString()).toBe('2025-11-14T12:00:00.000Z');
  });

  it('given any now, site=foo&time=hyper&period=7d&openingsColour=red → no site, no timeClass, period all, since null, openingsColour both', async () => {
    const { parseStatsFilters } = await filtersModule();
    for (const at of [new Date('2026-11-14T12:00:00Z'), new Date('2001-02-03T04:05:06Z'), new Date()]) {
      const f = parseStatsFilters(query('site=foo&time=hyper&period=7d&openingsColour=red'), at);
      expect(f.site).toBeUndefined();
      expect(f.timeClass).toBeUndefined();
      expect(f.period).toBe('all');
      expect(f.since).toBeNull();
      expect(f.openingsColour).toBe('both');
    }
  });

  it('the empty query string gives the same result as the unknown values', async () => {
    const { parseStatsFilters } = await filtersModule();
    for (const at of [new Date('2026-11-14T12:00:00Z'), new Date('2001-02-03T04:05:06Z')]) {
      const empty = parseStatsFilters(query(''), at);
      expect(empty).toEqual(parseStatsFilters(query('site=foo&time=hyper&period=7d&openingsColour=red'), at));
      expect(empty.site).toBeUndefined();
      expect(empty.timeClass).toBeUndefined();
      expect(empty.period).toBe('all');
      expect(empty.since).toBeNull();
      expect(empty.openingsColour).toBe('both');
    }
  });

  it('blank values fall back to their defaults', async () => {
    const { parseStatsFilters } = await filtersModule();
    const f = parseStatsFilters(query('site=&time=&period=&openingsColour='), new Date('2026-11-14T12:00:00Z'));
    expect(f.site).toBeUndefined();
    expect(f.timeClass).toBeUndefined();
    expect(f.period).toBe('all');
    expect(f.since).toBeNull();
    expect(f.openingsColour).toBe('both');
  });

  it('given series=lichess-blitz, series is lichess-blitz', async () => {
    const { parseStatsFilters } = await filtersModule();
    expect(parseStatsFilters(query('series=lichess-blitz'), now).series).toBe('lichess-blitz');
  });

  it('a series not of the form <site>-<time> is not kept', async () => {
    const { parseStatsFilters } = await filtersModule();
    expect(parseStatsFilters(query('series=not%20a%20series'), now).series).toBeUndefined();
  });
});

describe('scorePercent(wins, draws, games)', () => {
  it.each([
    [3, 1, 5, 70],
    [0, 2, 4, 25],
    [1, 0, 3, 33],
    [1, 0, 8, 13],
    [0, 0, 0, 0],
  ])('(%i, %i, %i) → %i', async (wins, draws, games, expected) => {
    const { scorePercent } = await scoreModule();
    expect(scorePercent(wins, draws, games)).toBe(expected);
  });
});
