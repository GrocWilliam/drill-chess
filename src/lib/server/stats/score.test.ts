import { describe, expect, it } from 'vitest';
import { pickSeries, scorePercent } from './score';

describe('scorePercent', () => {
  it.each([
    [3, 1, 5, 70],
    [0, 2, 4, 25],
    [1, 0, 3, 33],
    [1, 0, 8, 13],
    [0, 0, 0, 0],
    [2, 0, 2, 100],
    [0, 0, 3, 0],
  ])('(%i, %i, %i) → %i', (w, d, n, expected) => {
    expect(scorePercent(w, d, n)).toBe(expected);
  });
});

describe('pickSeries', () => {
  const mk = (site: string, time: string, n: number) => ({ site, time, points: new Array(n).fill(0) });
  it('picks the longest series, the earlier on a tie', () => {
    expect(pickSeries([mk('chesscom', 'blitz', 3), mk('chesscom', 'rapid', 5), mk('lichess', 'blitz', 2)])).toBe(1);
    expect(pickSeries([mk('chesscom', 'blitz', 4), mk('lichess', 'bullet', 4)])).toBe(0);
  });
  it('honours a requested series that exists', () => {
    const s = [mk('chesscom', 'blitz', 4), mk('lichess', 'bullet', 4)];
    expect(pickSeries(s, 'lichess-bullet')).toBe(1);
    expect(pickSeries(s, 'lichess-classical')).toBe(0);
    expect(pickSeries(s, 'nonsense')).toBe(0);
  });
  it('returns -1 with no series', () => {
    expect(pickSeries([])).toBe(-1);
  });
});
