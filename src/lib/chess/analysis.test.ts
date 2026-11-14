import { describe, expect, it } from 'vitest';
import { accuracy, computeReview, mark, moveLoss, phase, winChance, type Eval } from './analysis';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const r2 = (n: number) => Math.round(n * 100) / 100;
const OPERA =
  '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';

describe('analysis', () => {
  it('winChance', () => {
    const cases: [number, number][] = [[0, 50], [100, 59.1], [-100, 40.9], [300, 75.11], [1000, 97.54], [5000, 97.54], [-5000, 2.46]];
    for (const [cp, want] of cases) expect(r2(winChance({ cp }))).toBe(want);
    expect(winChance({ mate: 3 })).toBe(100);
    expect(winChance({ mate: -2 })).toBe(0);
    expect(winChance({ mate: 0 }, 'w')).toBe(0);
    expect(winChance({ mate: 0 }, 'b')).toBe(100);
  });
  it('moveLoss', () => {
    expect(moveLoss(75.11, 50, 'w')).toBeCloseTo(25.11, 2);
    expect(moveLoss(50, 75.11, 'b')).toBeCloseTo(25.11, 2);
    expect(moveLoss(50, 59.1, 'w')).toBe(0);
    expect(moveLoss(50, 40.9, 'b')).toBe(0);
  });
  it('mark', () => {
    const c: [number, string | null][] = [[30, 'blunder'], [29.99, 'mistake'], [20, 'mistake'], [19.99, 'inaccuracy'], [10, 'inaccuracy'], [9.99, null]];
    for (const [l, w] of c) expect(mark(l, 'a1a2', 'h1h2')).toBe(w);
    expect(mark(50, 'e2e4', 'e2e4')).toBeNull();
    expect(mark(50, 'e2e4', null)).toBe('blunder');
  });
  it('accuracy', () => {
    expect(accuracy([0])).toBe(100);
    expect(accuracy([5, 5])).toBe(79.8);
    expect(accuracy([10])).toBe(63.6);
    expect(accuracy([30])).toBe(24.8);
    expect(accuracy([])).toBe(100);
    expect(accuracy([200])).toBe(0);
  });
  it('phase', () => {
    const e = 'r3k3/8/8/8/8/8/8/R2NK3 w - - 0 40';
    expect(phase(START, 20)).toBe('opening');
    expect(phase(START, 21)).toBe('middlegame');
    expect(phase(e, 21)).toBe('endgame');
    expect(phase('rn2k3/8/8/8/8/8/8/R2NK3 w - - 0 40', 21)).toBe('middlegame');
    expect(phase(e, 20)).toBe('opening');
  });
  it('computeReview', () => {
    const flat: Eval[] = Array.from({ length: 34 }, (_, i) => (i === 33 ? { mate: 0 } : { cp: 0 }));
    const none = Array(33).fill(null);
    const a = computeReview(OPERA, flat, none);
    expect(a.marks.every((m) => m === null)).toBe(true);
    expect(a.phases.slice(0, 20).every((p) => p === 'opening')).toBe(true);
    expect(a.accuracyWhite).toBe(100);
    expect(a.accuracyBlack).toBe(100);
    const drop: Eval[] = [{ cp: 0 }, ...Array.from({ length: 33 }, () => ({ cp: -300 }))];
    const b = computeReview(OPERA, drop, none);
    const want = accuracy([25.11, ...Array(16).fill(0)]);
    expect(b.marks[0]).toBe('mistake');
    expect(b.marks.slice(1).every((m) => m === null)).toBe(true);
    expect(b.accuracyBlack).toBe(100);
    expect(b.accuracyWhite).toBe(want);
    const c = computeReview(OPERA, drop, ['e2e4', ...none.slice(1)]);
    expect(c.marks[0]).toBeNull();
    expect(c.accuracyWhite).toBe(want);
  });
});

import { evalText } from './analysis';

describe('evalText', () => {
  it('writes centipawns with one decimal and a sign, mates as M, checkmate as the result', () => {
    expect(evalText({ cp: 123 }, 'w')).toBe('+1.2');
    expect(evalText({ cp: -40 }, 'b')).toBe('−0.4');
    expect(evalText({ cp: 0 }, 'w')).toBe('0.0');
    expect(evalText({ cp: -4 }, 'w')).toBe('0.0');
    expect(evalText({ mate: 3 }, 'w')).toBe('M3');
    expect(evalText({ mate: -2 }, 'w')).toBe('−M2');
    expect(evalText({ mate: 0 }, 'b')).toBe('1-0');
    expect(evalText({ mate: 0 }, 'w')).toBe('0-1');
  });
});
