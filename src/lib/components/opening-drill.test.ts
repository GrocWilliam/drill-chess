import { describe, expect, test } from 'vitest';
import { arrowOf, editHref, formatDay, judge, lineQuery, parseDrillQuery, parseLine, stepAt, type DrillMove } from './opening-drill';

const mv = (uci: string, by: 'player' | 'opponent', due = false, cardId: string | null = by === 'player' ? 'c' : null): DrillMove => ({
  uci, san: uci, by, cardId, due,
});

describe('stepAt', () => {
  const moves = [mv('e2e4', 'opponent'), mv('c7c5', 'player', true), mv('g1f3', 'opponent'), mv('d7d6', 'player', false)];
  test('opponent and non-due player moves are automatic, a due card waits, past the end is the end', () => {
    expect(stepAt(moves, 0).kind).toBe('auto');
    expect(stepAt(moves, 1)).toEqual({ kind: 'wait', move: moves[1] });
    expect(stepAt(moves, 3).kind).toBe('auto');
    expect(stepAt(moves, 4).kind).toBe('end');
  });
});

describe('judge', () => {
  const m = mv('c7c5', 'player', true);
  test('right first time reviews true, wrong reviews false once, the right move after a miss sends nothing', () => {
    expect(judge(m, 'c7c5', false)).toEqual({ correct: true, review: true });
    expect(judge(m, 'e7e5', false)).toEqual({ correct: false, review: false });
    expect(judge(m, 'e7e5', true)).toEqual({ correct: false, review: null });
    expect(judge(m, 'c7c5', true)).toEqual({ correct: true, review: null });
  });
});

test('lineQuery adds seed + k only with a seed', () => {
  expect(lineQuery('black', 1, 1)).toBe('colour=black&seed=2');
  expect(lineQuery('both', null, 3)).toBe('colour=both');
});

test('arrowOf, editHref, formatDay', () => {
  expect(arrowOf('c7c5')).toEqual({ orig: 'c7', dest: 'c5', brush: 'green' });
  expect(editHref('both')).toBe('/openings');
  expect(editHref('white')).toBe('/openings/white');
  expect(formatDay('2026-11-15', 'en')).toBe('11/15/2026');
  expect(formatDay('2026-11-15', 'fr')).toBe('15/11/2026');
});

describe('parseLine', () => {
  test('reads a line and an empty answer, rejects malformed bodies', () => {
    expect(parseLine({ moves: [], nextDue: '2026-11-19' })).toEqual({ moves: [], nextDue: '2026-11-19' });
    expect(parseLine({ moves: [] })).toEqual({ moves: [], nextDue: null });
    const line = { colour: 'white', moves: [{ uci: 'e2e4', san: 'e4', by: 'player', cardId: 'x', due: true }], opening: { eco: 'B00', name: 'King' } };
    expect(parseLine(line)).toEqual(line);
    expect(parseLine({ ...line, colour: 'red' })).toBeNull();
    expect(parseLine({ ...line, moves: [{ uci: 1 }] })).toBeNull();
    expect(parseLine(null)).toBeNull();
  });
});

test('parseDrillQuery: colour white|black else both, seed an integer ≥ 0 else null', () => {
  const q = (s: string) => parseDrillQuery(new URLSearchParams(s));
  expect(q('colour=white&seed=3')).toEqual({ colour: 'white', seed: 3 });
  expect(q('colour=black')).toEqual({ colour: 'black', seed: null });
  expect(q('colour=red&seed=-1')).toEqual({ colour: 'both', seed: null });
  expect(q('seed=1.5')).toEqual({ colour: 'both', seed: null });
  expect(q('seed=0')).toEqual({ colour: 'both', seed: 0 });
});
