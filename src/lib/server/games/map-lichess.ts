// Maps a Lichess export game to a `games` row (pure; plies are counted by the caller).
import type { LichessGame } from '../gateway/lichess';
import { STANDARD_START, type MappedGame } from './map-chesscom';

const SPEEDS: Record<string, MappedGame['timeClass']> = {
  ultraBullet: 'bullet',
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapid',
  classical: 'classical',
  correspondence: 'daily',
};

/** The Lichess game as a row, or null when it is skipped (variant, custom start, not the user's, no PGN...). `clock` is null without one. */
export function mapLichessGame(game: LichessGame, username: string): (Omit<MappedGame, 'clock'> & { clock: string | null }) | null {
  if (game.variant !== 'standard') return null;
  if (game.initialFen !== undefined && game.initialFen !== STANDARD_START) return null;
  if (!game.pgn) return null;
  const me = username.toLowerCase();
  const is = (side: 'white' | 'black') => game.players[side].user?.name.toLowerCase() === me;
  const colour = is('white') ? 'white' : is('black') ? 'black' : null;
  if (!colour) return null;
  const timeClass = SPEEDS[game.speed];
  if (!timeClass) return null;
  const name = (side: 'white' | 'black') => {
    const p = game.players[side];
    if (p.user) return p.user.name;
    return p.aiLevel !== undefined ? `Stockfish level ${p.aiLevel}` : 'Anonymous';
  };
  const rating = (side: 'white' | 'black') => (game.players[side].user ? (game.players[side].rating ?? null) : null);
  return {
    siteGameId: game.id,
    url: `https://lichess.org/${game.id}`,
    endedAt: new Date(game.lastMoveAt),
    timeClass,
    clock: game.clock ? `${game.clock.initial}+${game.clock.increment}` : null,
    colour,
    result: game.winner === undefined ? 'draw' : game.winner === colour ? 'win' : 'loss',
    whiteName: name('white'),
    blackName: name('black'),
    whiteRating: rating('white'),
    blackRating: rating('black'),
    eco: game.opening?.eco ?? null,
    opening: game.opening?.name ?? null,
    pgn: game.pgn,
  };
}
