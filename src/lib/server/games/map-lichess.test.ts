import { describe, expect, it } from 'vitest';
import type { LichessGame } from '../gateway/lichess';
import { STANDARD_START } from './map-chesscom';
import { mapLichessGame } from './map-lichess';

const game = (over: Partial<LichessGame> = {}): LichessGame => ({
  id: 'AbCdEf12',
  variant: 'standard',
  speed: 'blitz',
  lastMoveAt: 1_700_000_000_000,
  winner: 'white',
  pgn: '1. e4 e5 1-0',
  clock: { initial: 180, increment: 2 },
  opening: { eco: 'B01', name: 'Scandinavian Defense' },
  players: {
    white: { user: { name: 'made_up_a' }, rating: 1500 },
    black: { user: { name: 'made_up_foe' }, rating: 1610 },
  },
  ...over,
});

describe('mapLichessGame', () => {
  it('maps a win as White', () => {
    expect(mapLichessGame(game(), 'MADE_UP_A')).toMatchObject({
      siteGameId: 'AbCdEf12',
      url: 'https://lichess.org/AbCdEf12',
      endedAt: new Date(1_700_000_000_000),
      timeClass: 'blitz',
      clock: '180+2',
      colour: 'white',
      result: 'win',
      blackName: 'made_up_foe',
      blackRating: 1610,
      eco: 'B01',
      opening: 'Scandinavian Defense',
    });
  });
  it('maps the speeds', () => {
    const c = (speed: string) => mapLichessGame(game({ speed }), 'made_up_a')?.timeClass;
    expect(c('ultraBullet')).toBe('bullet');
    expect(c('bullet')).toBe('bullet');
    expect(c('rapid')).toBe('rapid');
    expect(c('classical')).toBe('classical');
    expect(c('correspondence')).toBe('daily');
  });
  it('maps a draw and a loss', () => {
    expect(mapLichessGame(game({ winner: undefined }), 'made_up_a')?.result).toBe('draw');
    expect(mapLichessGame(game({ winner: 'black' }), 'made_up_a')?.result).toBe('loss');
  });
  it('has no clock without one', () => {
    expect(mapLichessGame(game({ clock: undefined }), 'made_up_a')?.clock).toBeNull();
  });
  it('names anonymous and AI opponents', () => {
    const anon = mapLichessGame(game({ players: { white: { user: { name: 'made_up_a' }, rating: 1500 }, black: {} } }), 'made_up_a');
    expect(anon).toMatchObject({ blackName: 'Anonymous', blackRating: null });
    const ai = mapLichessGame(game({ players: { white: { user: { name: 'made_up_a' } }, black: { aiLevel: 3 } } }), 'made_up_a');
    expect(ai).toMatchObject({ blackName: 'Stockfish level 3', blackRating: null });
  });
  it('skips variants, custom starts and other players', () => {
    expect(mapLichessGame(game({ variant: 'chess960' }), 'made_up_a')).toBeNull();
    expect(mapLichessGame(game({ initialFen: '8/8/8/8/8/8/8/K6k w - - 0 1' }), 'made_up_a')).toBeNull();
    expect(mapLichessGame(game({ initialFen: STANDARD_START }), 'made_up_a')).not.toBeNull();
    expect(mapLichessGame(game(), 'someone_else')).toBeNull();
  });
});
