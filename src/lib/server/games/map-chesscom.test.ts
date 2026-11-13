import { describe, expect, it } from 'vitest';
import type { ChesscomGame } from '../gateway/chesscom';
import { mapChesscomGame, openingFromEcoUrl, pgnHeader, resultOf, STANDARD_START } from './map-chesscom';

const pgn = (extra = '') =>
  `[Event "Live Chess"]\n[White "made_up_a"]\n[Black "made_up_b"]\n[ECO "C55"]\n${extra}[TimeControl "180"]\n\n1. e4 e5 1-0\n`;

const game = (over: Partial<ChesscomGame> = {}): ChesscomGame => ({
  url: 'https://www.chess.com/game/live/123456',
  pgn: pgn('[ECOUrl "https://www.chess.com/openings/Italian-Game-Two-Knights-Defense"]\n'),
  time_control: '180+2',
  end_time: 1_700_000_000,
  time_class: 'blitz',
  rules: 'chess',
  initial_setup: STANDARD_START,
  white: { username: 'made_up_a', rating: 1500, result: 'win' },
  black: { username: 'made_up_b', rating: 1400, result: 'resigned' },
  ...over,
});

describe('mapChesscomGame', () => {
  it('maps a win as White', () => {
    expect(mapChesscomGame(game(), 'made_up_a')).toEqual({
      siteGameId: '123456',
      url: 'https://www.chess.com/game/live/123456',
      endedAt: new Date(1_700_000_000_000),
      timeClass: 'blitz',
      clock: '180+2',
      colour: 'white',
      result: 'win',
      whiteName: 'made_up_a',
      blackName: 'made_up_b',
      whiteRating: 1500,
      blackRating: 1400,
      eco: 'C55',
      opening: 'Italian Game Two Knights Defense',
      pgn: game().pgn,
    });
  });

  it('maps a loss as Black, matching the username case-insensitively', () => {
    const g = mapChesscomGame(game({ black: { username: 'MADE_UP_B', rating: 1400, result: 'resigned' } }), 'made_up_b');
    expect(g).toMatchObject({ colour: 'black', result: 'loss', blackName: 'MADE_UP_B' });
  });

  it('has no opening without an ECOUrl', () => {
    expect(mapChesscomGame(game({ pgn: pgn() }), 'made_up_a')?.opening).toBeNull();
  });

  it('skips variants, custom starts and games of others', () => {
    expect(mapChesscomGame(game({ rules: 'chess960' }), 'made_up_a')).toBeNull();
    expect(mapChesscomGame(game({ initial_setup: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1' }), 'made_up_a')).toBeNull();
    expect(mapChesscomGame(game(), 'someone_else')).toBeNull();
  });
});

describe('resultOf', () => {
  it('maps win, every draw and the rest', () => {
    expect(resultOf('win')).toBe('win');
    for (const d of ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'])
      expect(resultOf(d)).toBe('draw');
    for (const l of ['checkmated', 'resigned', 'timeout', 'abandoned', 'lose']) expect(resultOf(l)).toBe('loss');
  });
});

describe('openingFromEcoUrl', () => {
  it('takes the last path segment, dashes as spaces', () => {
    expect(openingFromEcoUrl('https://www.chess.com/openings/Queens-Gambit-Declined')).toBe('Queens Gambit Declined');
    expect(openingFromEcoUrl('https://www.chess.com/openings/English-Opening/')).toBe('English Opening');
  });
  it('is null without a value', () => {
    expect(openingFromEcoUrl(null)).toBeNull();
    expect(openingFromEcoUrl('')).toBeNull();
  });
});

describe('pgnHeader', () => {
  it('reads a header or null', () => {
    expect(pgnHeader(pgn(), 'ECO')).toBe('C55');
    expect(pgnHeader(pgn(), 'ECOUrl')).toBeNull();
  });
});
