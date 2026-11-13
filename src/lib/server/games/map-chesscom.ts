// Maps a chess.com archive game to a `games` row (pure; plies are counted by the caller).
import type { ChesscomGame } from '../gateway/chesscom';

export const STANDARD_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'classical', 'daily'] as const;
const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

export interface MappedGame {
  siteGameId: string;
  url: string;
  endedAt: Date;
  timeClass: (typeof TIME_CLASSES)[number];
  clock: string;
  colour: 'white' | 'black';
  result: 'win' | 'draw' | 'loss';
  whiteName: string;
  blackName: string;
  whiteRating: number | null;
  blackRating: number | null;
  eco: string | null;
  opening: string | null;
  pgn: string;
}

/** A PGN header's value, or null. */
export function pgnHeader(pgn: string, name: string): string | null {
  const m = new RegExp(`^\\[${name} "((?:[^"\\\\]|\\\\.)*)"\\]\\s*$`, 'm').exec(pgn);
  return m ? m[1].replace(/\\(.)/g, '$1') : null;
}

/** The opening name of an `ECOUrl`: its last path segment with `-` → space, or null. */
export function openingFromEcoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // not an absolute URL: take it as a path
  }
  const last = path.split('/').filter(Boolean).pop();
  if (!last) return null;
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {
    // keep it as is
  }
  return name.replace(/-/g, ' ').trim() || null;
}

/** The player's result: win, a draw kind, else a loss. */
export function resultOf(code: string): 'win' | 'draw' | 'loss' {
  if (code === 'win') return 'win';
  return DRAWS.has(code) ? 'draw' : 'loss';
}

/** The row of `game` for the linked `username`, or null when it is skipped (variant, custom start, not theirs...). */
export function mapChesscomGame(game: ChesscomGame, username: string): MappedGame | null {
  if (game.rules !== 'chess') return null;
  if ((game.initial_setup ?? STANDARD_START) !== STANDARD_START) return null;
  if (!game.pgn) return null;
  const me = username.toLowerCase();
  const colour =
    game.white.username.toLowerCase() === me ? 'white' : game.black.username.toLowerCase() === me ? 'black' : null;
  if (!colour) return null;
  const timeClass = TIME_CLASSES.find((t) => t === game.time_class);
  if (!timeClass) return null;
  const siteGameId = game.url.split(/[?#]/)[0].split('/').filter(Boolean).pop();
  if (!siteGameId) return null;
  return {
    siteGameId,
    url: game.url,
    endedAt: new Date(game.end_time * 1000),
    timeClass,
    clock: game.time_control,
    colour,
    result: resultOf(game[colour].result),
    whiteName: game.white.username,
    blackName: game.black.username,
    whiteRating: game.white.rating ?? null,
    blackRating: game.black.rating ?? null,
    eco: pgnHeader(game.pgn, 'ECO'),
    opening: openingFromEcoUrl(pgnHeader(game.pgn, 'ECOUrl') ?? game.eco),
    pgn: game.pgn,
  };
}
