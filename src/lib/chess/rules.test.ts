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

import { positions, legalMoves, play, normaliseFen, turn, sanOf } from './rules';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('helpers', () => {
  it('positions', () => {
    const p = positions('1. e4 e5 2. Nf3');
    expect(p.fens).toHaveLength(4);
    expect(p.fens[0]).toBe(START);
    expect(p.moves[0]).toEqual({ san: 'e4', uci: 'e2e4', from: 'e2', to: 'e4' });
    expect(() => positions('1. e4 e4')).toThrow();
    expect(positions('[FEN "8/4P3/8/8/8/8/k7/4K3 w - - 0 1"]\n[SetUp "1"]\n\n1. e8=Q').moves[0].uci).toBe('e7e8q');
  });
  it('legalMoves', () => {
    const m = legalMoves(START);
    expect(m.size).toBe(10);
    expect([...m.values()].flat()).toHaveLength(20);
    expect(new Set(m.get('g1'))).toEqual(new Set(['f3', 'h3']));
  });
  it('play', () => {
    const want = 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1';
    expect(play(START, 'Nf3')).toBe(want);
    expect(play(START, 'g1f3')).toBe(want);
    for (const bad of ['Nf6', 'e2e5', 'Ke2', 'hello']) expect(play(START, bad)).toBeNull();
    const promo = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
    expect(play(promo, 'e8=Q')!.split('/')[0]).toBe('4Q3');
    expect(play(promo, 'e7e8q')!.split('/')[0]).toBe('4Q3');
  });
  it('normaliseFen, turn, sanOf', () => {
    expect(normaliseFen(START)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
    expect(turn(START)).toBe('w');
    expect(sanOf(START, 'g1f3')).toBe('Nf3');
    expect(sanOf(START, 'g1g3')).toBeNull();
  });
});
