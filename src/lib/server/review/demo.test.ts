import { describe, expect, it } from 'vitest';
import { countPlies, positions } from '$lib/chess/rules';
import { movesText } from '$lib/server/games';
import { demoGame } from './demo';

describe('demoGame', () => {
  it('is the Opera Game, a legal 33-ply PGN ending in mate', () => {
    const g = demoGame();
    expect(g).toMatchObject({
      whiteName: 'Paul Morphy',
      blackName: 'Duke of Brunswick and Count Isouard',
      event: 'Paris 1858',
      result: '1-0',
    });
    expect(countPlies(g.pgn)).toBe(33);
    expect(positions(g.pgn).moves.at(-1)?.san).toBe('Rd8#');
    expect(movesText(g.pgn)).toMatch(/^1\. e4 e5 2\. Nf3 d6 .* 17\. Rd8# 1-0$/);
  });
});
