import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import {
  START, OPERA, round2, repeat, operaEvalsFlat,
  winChance, moveLoss, mark, accuracy, phase, positions, legalMoves, play, normaliseFen, turn, sanOf, computeReview,
} from '../support/chess-lib';

describe('winChance', () => {
  it('converts centipawns to a win chance', () => {
    const cases: [number, number][] = [[0, 50], [100, 59.1], [-100, 40.9], [300, 75.11], [1000, 97.54], [5000, 97.54], [-5000, 2.46]];
    for (const [cp, want] of cases) expect(round2(winChance({ cp })), `cp ${cp}`).toBe(want);
  });
  it('maps mate scores', () => {
    expect(winChance({ mate: 3 })).toBe(100);
    expect(winChance({ mate: -2 })).toBe(0);
    expect(winChance({ mate: 0 }, 'w')).toBe(0);
    expect(winChance({ mate: 0 }, 'b')).toBe(100);
  });
});

describe('moveLoss', () => {
  it('is the mover\'s drop in win chance', () => {
    expect(moveLoss(75.11, 50, 'w')).toBeCloseTo(25.11, 2);
    expect(moveLoss(50, 75.11, 'b')).toBeCloseTo(25.11, 2);
  });
  it('is never below 0', () => {
    expect(moveLoss(50, 59.1, 'w')).toBe(0);
    expect(moveLoss(50, 40.9, 'b')).toBe(0);
  });
});

describe('mark', () => {
  it('classifies by loss thresholds', () => {
    const cases: [number, string | null][] = [[30, 'blunder'], [29.99, 'mistake'], [20, 'mistake'], [19.99, 'inaccuracy'], [10, 'inaccuracy'], [9.99, null]];
    for (const [loss, want] of cases) expect(mark(loss, 'e2e4', 'd2d4'), `loss ${loss}`).toBe(want);
  });
  it('is null when the best move was played', () => {
    expect(mark(50, 'e2e4', 'e2e4')).toBeNull();
  });
  it('still marks when there is no best move', () => {
    expect(mark(50, 'e2e4', null)).toBe('blunder');
  });
});

describe('accuracy', () => {
  it('maps the mean loss to an accuracy', () => {
    expect(accuracy([0])).toBe(100);
    expect(accuracy([5, 5])).toBe(79.8);
    expect(accuracy([10])).toBe(63.6);
    expect(accuracy([30])).toBe(24.8);
    expect(accuracy([200])).toBe(0);
  });
  it('is 100 for an empty list', () => {
    expect(accuracy([])).toBe(100);
  });
});

describe('phase', () => {
  const K = 'r3k3/8/8/8/8/8/8/R2NK3 w - - 0 40';
  it('opening up to ply 20, then by material', () => {
    expect(phase(START, 20)).toBe('opening');
    expect(phase(START, 21)).toBe('middlegame');
    expect(phase(K, 21)).toBe('endgame');
    expect(phase('rn2k3/8/8/8/8/8/8/R2NK3 w - - 0 40', 21)).toBe('middlegame');
    expect(phase(K, 20)).toBe('opening');
  });
});

describe('positions', () => {
  it('lists the fens and moves of the Opera Game', () => {
    const p = positions(OPERA);
    expect(p.fens).toHaveLength(34);
    expect(p.fens[0]).toBe(START);
    expect(p.moves).toHaveLength(33);
    expect(p.moves[0]).toEqual({ san: 'e4', uci: 'e2e4', from: 'e2', to: 'e4' });
    expect(p.moves[32]).toEqual({ san: 'Rd8#', uci: 'd1d8', from: 'd1', to: 'd8' });
  });
  it('throws on an illegal move', () => {
    expect(() => positions('1. e4 e4')).toThrow(Error);
  });
  it('gives the promotion letter in UCI', () => {
    const p = positions('[FEN "8/4P3/8/8/8/8/k7/4K3 w - - 0 1"]\n[SetUp "1"]\n\n1. e8=Q Ka3 *');
    expect(p.moves[0].uci).toBe('e7e8q');
  });
});

describe('legalMoves', () => {
  it('maps from squares to to squares', () => {
    const m = legalMoves(START);
    expect(m.size).toBe(10);
    expect([...m.values()].reduce((n, l) => n + l.length, 0)).toBe(20);
    expect(new Set(m.get('g1'))).toEqual(new Set(['f3', 'h3']));
  });
});

describe('play', () => {
  const afterNf3 = 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1';
  it('accepts SAN and UCI', () => {
    expect(play(START, 'Nf3')).toBe(afterNf3);
    expect(play(START, 'g1f3')).toBe(afterNf3);
  });
  it('returns null for illegal or unreadable moves', () => {
    for (const m of ['Nf6', 'e2e5', 'Ke2', 'hello']) expect(play(START, m), m).toBeNull();
  });
  it('handles promotion', () => {
    const fen = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
    expect(play(fen, 'e8=Q')!.split('/')[0]).toBe('4Q3');
    expect(play(fen, 'e7e8q')!.split('/')[0]).toBe('4Q3');
  });
});

describe('normaliseFen, turn, sanOf', () => {
  it('works on the start position', () => {
    expect(normaliseFen(START)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
    expect(turn(START)).toBe('w');
    expect(sanOf(START, 'g1f3')).toBe('Nf3');
    expect(sanOf(START, 'g1g3')).toBeNull();
  });
});

describe('computeReview', () => {
  it('finds nothing in a flat game', () => {
    const r = computeReview(OPERA, operaEvalsFlat(), repeat(null, 33));
    expect(r.marks).toEqual(repeat(null, 33));
    expect(r.phases).toHaveLength(33);
    expect(r.phases.slice(0, 20)).toEqual(repeat('opening', 20));
    expect(r.accuracyWhite).toBe(100);
    expect(r.accuracyBlack).toBe(100);
  });
  const evals = [{ cp: 0 }, ...repeat({ cp: -300 }, 33)];
  const whiteAcc = accuracy([25.11, ...repeat(0, 16)]);
  it('marks White\'s first move and scores accuracy', () => {
    const r = computeReview(OPERA, evals, repeat(null, 33));
    expect(r.marks[0]).toBe('mistake');
    expect(r.marks.slice(1)).toEqual(repeat(null, 32));
    expect(r.accuracyBlack).toBe(100);
    expect(Math.abs(r.accuracyWhite - whiteAcc)).toBeLessThanOrEqual(0.1);
  });
  it('does not mark the best move', () => {
    const best: (string | null)[] = repeat(null, 33);
    best[0] = 'e2e4';
    const r = computeReview(OPERA, evals, best);
    expect(r.marks[0]).toBeNull();
    expect(Math.abs(r.accuracyWhite - whiteAcc)).toBeLessThanOrEqual(0.1);
  });
});

describe('make test', () => {
  it('has the analysis unit tests', () => {
    expect(existsSync('src/lib/chess/analysis.test.ts')).toBe(true);
  });
});
