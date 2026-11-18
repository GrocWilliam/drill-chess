import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchOpening, openingFor, parseOpenings } from './openings';

const NAJDORF = 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6'.split(' ');

describe('openingFor', () => {
  it('finds names', () => {
    expect(openingFor(['e2e4', 'c7c5'])).toEqual({ eco: 'B20', name: 'Sicilian Defense' });
    expect(openingFor(NAJDORF)).toEqual({ eco: 'B90', name: 'Sicilian Defense: Najdorf Variation' });
    expect(openingFor(['a2a3'])).toEqual({ eco: 'A00', name: "Anderssen's Opening" });
    expect(openingFor([])).toBeNull();
  });
  it('takes the longest prefix', () => {
    const more = [...NAJDORF, 'c1e3', 'e7e5', 'd4b3', 'c8e6', 'f2f3'];
    expect(openingFor(more)?.eco).toBe('B90');
  });
});

describe('parseOpenings / matchOpening', () => {
  it('indexes a small dataset', () => {
    const idx = parseOpenings('eco\tname\tpgn\nA00\tOne\t1. e4\nB00\tTwo\t1. e4 e5\n');
    expect(idx.maxPlies).toBe(2);
    expect(matchOpening(idx, ['e2e4', 'e7e5', 'g1f3'])?.name).toBe('Two');
    expect(matchOpening(idx, ['d2d4'])).toBeNull();
  });
});

describe('dataset file', () => {
  it('has the header and a plausible size', () => {
    const lines = readFileSync('static/openings/openings.tsv', 'utf8').trim().split('\n');
    expect(lines[0]).toBe('eco\tname\tpgn');
    expect(lines.length - 1).toBeGreaterThan(3000);
    expect(lines.length - 1).toBeLessThan(5000);
  });
});
