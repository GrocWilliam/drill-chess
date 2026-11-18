import { describe, expect, it } from 'vitest';
import { applyMove, initialState, judgeMove, outcome, playerMoveIndex, playerMoves, sideToMove, terminalOf } from './endgame-play';

const KQK = '8/8/8/4k3/8/8/8/3QK3 w - - 0 1';
const play = (fen: string, ucis: string[]) => ucis.reduce((s, u) => applyMove(s, u)!, initialState(fen));

describe('endgame-play', () => {
  it('starts empty', () => expect(initialState(KQK)).toEqual({ fen: KQK, fens: [KQK], moves: [] }));
  it('applies a legal move in SAN and keeps the FENs', () => {
    const s = applyMove(initialState(KQK), 'd1d4')!;
    expect(s.moves).toEqual(['Qd4']);
    expect(s.fens).toHaveLength(2);
    expect(s.lastMove).toEqual(['d1', 'd4']);
  });
  it('rejects an illegal move', () => expect(applyMove(initialState(KQK), 'd1d9')).toBeNull());
  it('reads the side to move', () => {
    expect(sideToMove(KQK)).toBe('white');
    expect(sideToMove('8/8/8/8/8/8/8/k1K5 b - - 0 1')).toBe('black');
  });
  it('counts player moves', () => {
    expect(playerMoves(play(KQK, ['d1d4']))).toBe(1);
    expect(playerMoves(play(KQK, ['d1d4', 'e5e6']))).toBe(1);
  });
});

describe('judgeMove', () => {
  it('a win goal continues only while the app loses', () => {
    expect(judgeMove('win', 'loss')).toBe('continue');
    expect(judgeMove('win', 'maybe-loss')).toBe('continue');
    for (const c of ['draw', 'blessed-loss', 'win', 'cursed-win', 'unknown']) expect(judgeMove('win', c)).toBe('fail');
  });
  it('a draw goal fails only when the app wins', () => {
    expect(judgeMove('draw', 'win')).toBe('fail');
    expect(judgeMove('draw', 'maybe-win')).toBe('fail');
    for (const c of ['draw', 'loss', 'blessed-loss', 'cursed-win', 'unknown']) expect(judgeMove('draw', c)).toBe('continue');
  });
});

describe('outcome', () => {
  const beforeMate = '8/8/8/8/8/Q7/5K2/7k w - - 0 1';
  it('a mate by the player passes', () => {
    const s = play(beforeMate, ['a3h3']);
    expect(terminalOf(s.fens)).toBe('checkmate');
    expect(outcome('win', s, true)).toBe('pass');
  });
  it('a stalemate fails a win goal and passes a draw goal, the player move being the failing one', () => {
    const s = play(beforeMate, ['a3g3']);
    expect(outcome('win', s, true)).toBe('fail');
    expect(outcome('draw', s, true)).toBe('pass');
    expect(playerMoveIndex(s, true)).toBe(0);
  });
  it('a mate of the player fails', () => {
    const s = play('7K/8/6k1/8/8/8/8/q7 b - - 0 1', ['a1a8']);
    expect(outcome('draw', s, false)).toBe('fail');
    expect(playerMoveIndex(play('7K/8/6k1/8/8/8/8/q7 w - - 0 1', ['h8g8', 'a1a8']), false)).toBe(0);
  });
  it('insufficient material and the 50-move rule are draws', () => {
    expect(terminalOf(play('8/8/8/4k3/4n3/8/8/R3K3 b - - 0 1', ['e4f2', 'a1a5']).fens)).toBeNull();
    expect(terminalOf(['8/8/8/4k3/8/8/8/4K3 w - - 0 1'])).toBe('draw');
    expect(terminalOf(['8/8/8/4k3/4n3/8/8/R3K3 b - - 100 80'])).toBe('draw');
  });
  it('a threefold repetition (counters ignored) is a draw', () => {
    const start = '8/8/8/4k3/4n3/8/8/R3K3 b - - 0 1';
    const s = play(start, ['e5e6', 'e1e2', 'e6d6', 'e2e1', 'd6e6', 'e1e2', 'e6d6', 'e2e1']);
    expect(outcome('draw', s, false)).toBeNull();
    const t = applyMove(s, 'd6e6')!;
    expect(outcome('draw', t, true)).toBe('pass');
  });
});
