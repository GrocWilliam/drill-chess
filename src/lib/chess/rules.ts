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

export type Move = { san: string; uci: string; from: string; to: string };

/** Every position of `pgn` (moves + 1 FENs) and its moves. Throws an Error when chess.js cannot parse it. */
export function positions(pgn: string): { fens: string[]; moves: Move[] } {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const verbose = chess.history({ verbose: true });
  const fens = [verbose.length ? verbose[0].before : chess.fen()];
  const moves: Move[] = [];
  for (const m of verbose) {
    fens.push(m.after);
    moves.push({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), from: m.from, to: m.to });
  }
  return { fens, moves };
}

/** From square → to squares of the legal moves, for chessground. */
export function legalMoves(fen: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const m of new Chess(fen).moves({ verbose: true })) {
    const list = map.get(m.from);
    if (list) list.push(m.to);
    else map.set(m.from, [m.to]);
  }
  return map;
}

/** The FEN after a move given in SAN or UCI, or null when illegal or unreadable. */
export function play(fen: string, sanOrUci: string): string | null {
  try {
    const chess = new Chess(fen);
    const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(sanOrUci);
    if (uci) chess.move({ from: uci[1], to: uci[2], promotion: uci[3] });
    else chess.move(sanOrUci);
    return chess.fen();
  } catch {
    return null;
  }
}

/** The FEN without the half-move and full-move counters. */
export function normaliseFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function turn(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/** The SAN of a UCI move, or null when illegal. */
export function sanOf(fen: string, uci: string): string | null {
  try {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
    if (!m) return null;
    return new Chess(fen).move({ from: m[1], to: m[2], promotion: m[3] }).san;
  } catch {
    return null;
  }
}
