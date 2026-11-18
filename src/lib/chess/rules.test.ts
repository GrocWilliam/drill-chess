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

import { uciOf, isPromotion } from './rules';

const PROMO = 'r2qkbnr/1Ppppppp/2n5/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 1 5';

describe('uciOf', () => {
  it('reads SAN and UCI', () => {
    expect(uciOf(START, 'Nf3')).toBe('g1f3');
    expect(uciOf(START, ' e2e4 ')).toBe('e2e4');
    expect(uciOf(PROMO, 'bxa8=Q')).toBe('b7a8q');
    expect(uciOf(PROMO, 'b7a8n')).toBe('b7a8n');
  });
  it('is null for an illegal or unreadable move', () => {
    expect(uciOf(START, 'Ke2')).toBeNull();
    expect(uciOf(START, 'hello')).toBeNull();
    expect(uciOf(START, '')).toBeNull();
    expect(uciOf(PROMO, 'b7a8')).toBeNull();
  });
});

describe('isPromotion', () => {
  it('is true only for a legal pawn move to the last rank', () => {
    expect(isPromotion(PROMO, 'b7', 'a8')).toBe(true);
    expect(isPromotion(PROMO, 'b7', 'b8')).toBe(true);
    expect(isPromotion(PROMO, 'b2', 'b4')).toBe(false);
    expect(isPromotion(START, 'e2', 'e4')).toBe(false);
    expect(isPromotion('not a fen', 'e2', 'e4')).toBe(false);
  });
});

import { inCheck } from './rules';

describe('inCheck', () => {
  it('tells whether the side to move is in check', () => {
    expect(inCheck('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')).toBe(true);
    expect(inCheck(START)).toBe(false);
    expect(inCheck('junk')).toBe(false);
  });
});

import { terminal } from './rules';

describe('terminal', () => {
  it('tells checkmate, stalemate and a playable position apart', () => {
    expect(terminal('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')).toBe('checkmate');
    expect(terminal('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toBe('stalemate');
    expect(terminal('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });
});

import { uciLine } from './rules';
describe('uciLine', () => {
  it('replays only maxPlies', () => {
    expect(uciLine('1. e4 e5 2. Nf3 Nc6', 3)).toEqual(['e2e4', 'e7e5', 'g1f3']);
    expect(uciLine('1. e4 e5 2. Nf3 Nc6')).toHaveLength(4);
  });
});

describe('uciOf with French piece letters', () => {
  it('reads Cf3 as Nf3 when English fails', () => {
    expect(uciOf('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'Cf3')).toBe('g1f3');
    expect(uciOf('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'Ce5')).toBeNull();
  });
});
