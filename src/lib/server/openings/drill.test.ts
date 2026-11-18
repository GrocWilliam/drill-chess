import { describe, expect, it } from 'vitest';
import { dueBelow, graphOf, mulberry32, pickLine, pickWeighted, type DrillMove } from './drill';

const mv = (fromFen: string, toFen: string, by: 'player' | 'opponent', cardId: string | null = null, due = false): DrillMove => ({
  fromFen, toFen, uci: `${fromFen}${toFen}`, san: toFen, by, cardId, due,
});

describe('mulberry32', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('pickWeighted', () => {
  it('follows the weights', () => {
    const r = mulberry32(7);
    let first = 0;
    for (let i = 0; i < 1000; i++) if (pickWeighted([4, 1], r) === 0) first++;
    expect(first).toBeGreaterThan(740);
    expect(first).toBeLessThan(860);
    expect(pickWeighted([1, 1], () => 0.999999)).toBe(1);
  });
});

describe('pickLine', () => {
  // S -p-> A; A -o-> B (due card below) | C (none); B -p-> D (due), C -p-> E (not due)
  const g = graphOf([
    mv('S', 'A', 'player', 'c1', true),
    mv('A', 'B', 'opponent'),
    mv('A', 'C', 'opponent'),
    mv('B', 'D', 'player', 'c2', true),
    mv('C', 'E', 'player', 'c3', false),
  ]);
  it('counts distinct due cards below a move', () => {
    expect(dueBelow(g, g.get('A')![0])).toBe(1);
    expect(dueBelow(g, g.get('A')![1])).toBe(0);
    expect(dueBelow(g, g.get('S')![0])).toBe(2);
  });
  it('walks to the end, weighting branches 2:1', () => {
    const r = mulberry32(3);
    let b = 0;
    for (let i = 0; i < 600; i++) {
      const line = pickLine(g, 'S', r).map((m) => m.toFen);
      expect(line.length).toBe(3);
      if (line[1] === 'B') b++;
    }
    expect(b).toBeGreaterThan(340);
    expect(b).toBeLessThan(460);
  });
  it('stops on a visited position', () => {
    const cyc = graphOf([mv('S', 'A', 'player', 'c1', true), mv('A', 'B', 'opponent'), mv('B', 'S', 'player', 'c2', true)]);
    expect(pickLine(cyc, 'S', Math.random).map((m) => m.toFen)).toEqual(['A', 'B', 'S']);
    expect(dueBelow(cyc, cyc.get('A')![0])).toBe(2);
  });
  it('is empty without moves at the start', () => {
    expect(pickLine(g, 'X', Math.random)).toEqual([]);
  });
});
