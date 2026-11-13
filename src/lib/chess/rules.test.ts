import { describe, expect, it } from 'vitest';
import { countPlies } from './rules';

describe('countPlies', () => {
  it('counts the half-moves', () => {
    expect(countPlies('1. e4 e5 2. Nf3')).toBe(3);
    expect(countPlies('[White "a"]\n[Black "b"]\n\n1. f3 e5 2. g4 Qh4# 0-1\n')).toBe(4);
  });
  it('is 0 for a game without moves', () => expect(countPlies('*')).toBe(0));
  it('is null for an invalid PGN', () => {
    expect(countPlies('1. e4 e5 2. Ke3 Nf6')).toBeNull();
    expect(countPlies('1. e4 e5 2. Zz9')).toBeNull();
  });
});
