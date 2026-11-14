import { describe, expect, it } from 'vitest';
import { plyFromQuery } from './ply';

const pgn = '1. e4 e5 2. Nf3 Nc6 *'; // 4 plies

describe('plyFromQuery', () => {
  it('keeps a ply inside the game', () => {
    expect(plyFromQuery('3', pgn)).toBe(3);
    expect(plyFromQuery(' 4 ', pgn)).toBe(4);
  });
  it('clamps to 0…plies', () => {
    expect(plyFromQuery('99999', pgn)).toBe(4);
    expect(plyFromQuery('-2', pgn)).toBe(0);
  });
  it('reads a missing or bad value as 0', () => {
    expect(plyFromQuery(null, pgn)).toBe(0);
    expect(plyFromQuery('x', pgn)).toBe(0);
    expect(plyFromQuery('2.5', pgn)).toBe(0);
    expect(plyFromQuery('', pgn)).toBe(0);
  });
  it('is 0 for an unreadable PGN', () => {
    expect(plyFromQuery('3', 'not a pgn ((')).toBe(0);
  });
});
