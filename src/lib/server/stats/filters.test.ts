import { describe, expect, it } from 'vitest';
import { parseStatsFilters } from './filters';

const q = (s: string) => new URLSearchParams(s);
const at = new Date('2026-11-14T12:00:00Z');

describe('parseStatsFilters', () => {
  it('reads every known value', () => {
    expect(parseStatsFilters(q('site=lichess&time=blitz&period=90d&openingsColour=black&series=chesscom-daily'), at)).toEqual({
      site: 'lichess',
      timeClass: 'blitz',
      period: '90d',
      since: new Date('2026-08-16T12:00:00Z'),
      openingsColour: 'black',
      series: 'chesscom-daily',
    });
  });

  it('since = now − N × 24 h', () => {
    expect(parseStatsFilters(q('period=30d'), at).since?.toISOString()).toBe('2026-10-15T12:00:00.000Z');
    expect(parseStatsFilters(q('period=365d'), at).since?.toISOString()).toBe('2025-11-14T12:00:00.000Z');
    expect(parseStatsFilters(q('period=all'), at).since).toBeNull();
  });

  it('unknown, blank or missing values give the defaults', () => {
    const defaults = { period: 'all', since: null, openingsColour: 'both' };
    expect(parseStatsFilters(q('site=foo&time=hyper&period=7d&openingsColour=red&series=foo-blitz'), at)).toEqual(defaults);
    expect(parseStatsFilters(q('site=&time=&period=&openingsColour=&series='), at)).toEqual(defaults);
    expect(parseStatsFilters(q(''), at)).toEqual(defaults);
    expect(parseStatsFilters(q('series=lichess-hyper'), at).series).toBeUndefined();
  });
});
