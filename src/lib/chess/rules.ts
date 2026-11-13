// Chess rules through chess.js: browser-safe, shared by the server and the pages.
import { Chess } from 'chess.js';

/** The number of half-moves of `pgn`, or null when chess.js cannot parse it (an illegal move, a bad header...). */
export function countPlies(pgn: string): number | null {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }
  return chess.history().length;
}
