import { describe, expect, it } from 'vitest';
import { scorePercent } from './score';

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
