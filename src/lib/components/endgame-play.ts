// Pure logic of the endgame board page: moves, terminal positions (checked in the browser, no tablebase call) and
// the judgement of each player move from the tablebase category for the app.
import { halfmoveClock, insufficientMaterial, normaliseFen, play, sanOf, terminal } from '../chess/rules';

export type Goal = 'win' | 'draw';
/** `fens` = every position of the attempt, the start first (threefold repetition is read from it). */
export type PlayState = { fen: string; fens: string[]; moves: string[]; lastMove?: [string, string] };

/** A draw goal passes once the player has made this many moves judged `continue`. */
export const DRAW_MOVES = 20;

export const initialState = (fen: string): PlayState => ({ fen, fens: [fen], moves: [] });

/** The state after a UCI move (the player's or the app's), or null when it is illegal. SAN is shown without +/#. */
export function applyMove(state: PlayState, uci: string): PlayState | null {
  const san = sanOf(state.fen, uci);
  const fen = play(state.fen, uci);
  if (!san || !fen) return null;
  return {
    fen,
    fens: [...state.fens, fen],
    moves: [...state.moves, san.replace(/[+#]$/, '')],
    lastMove: [uci.slice(0, 2), uci.slice(2, 4)],
  };
}

export const sideToMove = (fen: string): 'white' | 'black' => (fen.split(' ')[1] === 'b' ? 'black' : 'white');

/**
 * A player move judged from the tablebase `category` for the app (to move): a win goal fails unless the app is
 * `loss`/`maybe-loss`; a draw goal fails only when the app is `win`/`maybe-win`.
 */
export function judgeMove(goal: Goal, category: string): 'fail' | 'continue' {
  if (goal === 'win') return category === 'loss' || category === 'maybe-loss' ? 'continue' : 'fail';
  return category === 'win' || category === 'maybe-win' ? 'fail' : 'continue';
}

/** `checkmate` (the side to move is mated), `draw` (stalemate, insufficient material, threefold, 50-move rule) or null. */
export function terminalOf(fens: string[]): 'checkmate' | 'draw' | null {
  const fen = fens[fens.length - 1];
  const end = terminal(fen);
  if (end === 'checkmate') return 'checkmate';
  if (end === 'stalemate' || insufficientMaterial(fen) || halfmoveClock(fen) >= 100) return 'draw';
  const key = normaliseFen(fen);
  return fens.filter((f) => normaliseFen(f) === key).length >= 3 ? 'draw' : null;
}

/**
 * The result of the attempt after the last move of `state` (made by the player when `byPlayer`), or null when it
 * goes on: a mate by the player passes, a mate of the player fails; a draw passes a draw goal and fails a win goal.
 */
export function outcome(goal: Goal, state: PlayState, byPlayer: boolean): 'pass' | 'fail' | null {
  const end = terminalOf(state.fens);
  if (end === 'checkmate') return byPlayer ? 'pass' : 'fail';
  if (end === 'draw') return goal === 'draw' ? 'pass' : 'fail';
  return null;
}

/** Index in `moves` of the player's last move: the last one when it was theirs, else the one before. */
export const playerMoveIndex = (state: PlayState, byPlayer: boolean): number => state.moves.length - (byPlayer ? 1 : 2);

/** The number of moves the player has made (they move first). */
export const playerMoves = (state: PlayState): number => Math.ceil(state.moves.length / 2);
