// Pure logic of the drill client (OpeningDrill.svelte): which step comes next in a line, how a player's move is
// judged, and the query of the next line. Browser-safe: no server import.

export type DrillColour = 'white' | 'black' | 'both';
export type DrillMove = { uci: string; san: string; by: 'player' | 'opponent'; cardId: string | null; due: boolean };
export type DrillLine =
  | { colour: 'white' | 'black'; moves: DrillMove[]; opening: { eco: string; name: string } | null }
  | { moves: []; nextDue: string | null };

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Milliseconds between two automatic moves. */
export const AUTO_DELAY = 300;
/** Cards of one drill of one drill. */
export const DRILL_CARDS = 20;

export type Step = { kind: 'auto'; move: DrillMove } | { kind: 'wait'; move: DrillMove } | { kind: 'end' };

/** The step at index `i` of `moves`: a due player card waits for the player, any other move is played automatically. */
export function stepAt(moves: DrillMove[], i: number): Step {
  const move = moves[i];
  if (!move) return { kind: 'end' };
  return move.by === 'player' && move.due && move.cardId ? { kind: 'wait', move } : { kind: 'auto', move };
}

/**
 * Judges the player's `uci` against the awaited `move`. `missed` tells whether this card was already answered wrong.
 * → `correct` (the line goes on), `review` (the value to POST for the card, or null when none is to be sent).
 */
export function judge(move: DrillMove, uci: string, missed: boolean): { correct: boolean; review: boolean | null } {
  const correct = uci === move.uci;
  return { correct, review: missed ? null : correct };
}

/** The query of GET /api/openings/drill for line `k` of the drill (line 0 is the server's first line). */
export function lineQuery(colour: DrillColour, seed: number | null, k: number): string {
  const q = new URLSearchParams({ colour });
  if (seed !== null) q.set('seed', String(seed + k));
  return q.toString();
}

/** The squares of a UCI move, as a chessground arrow. */
export const arrowOf = (uci: string, brush = 'green') => ({ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush });

/** Where `drill-none-edit` leads: the colour's editor, or the openings home for both. */
export const editHref = (colour: DrillColour) => (colour === 'both' ? '/openings' : `/openings/${colour}`);

/** A YYYY-MM-DD day formatted as the games list formats dates. */
export const formatDay = (day: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

/** Parses a line from the drill API (unknown JSON) → the line, or null when malformed. */
export function parseLine(body: unknown): DrillLine | null {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { moves?: unknown }).moves)) return null;
  const b = body as Record<string, unknown> & { moves: unknown[] };
  if (b.moves.length === 0) {
    const nextDue = typeof b.nextDue === 'string' ? b.nextDue : null;
    return { moves: [], nextDue };
  }
  if (b.colour !== 'white' && b.colour !== 'black') return null;
  const moves: DrillMove[] = [];
  for (const m of b.moves) {
    if (!m || typeof m !== 'object') return null;
    const x = m as Record<string, unknown>;
    if (typeof x.uci !== 'string' || typeof x.san !== 'string' || (x.by !== 'player' && x.by !== 'opponent')) return null;
    moves.push({
      uci: x.uci,
      san: x.san,
      by: x.by,
      cardId: typeof x.cardId === 'string' ? x.cardId : null,
      due: x.due === true,
    });
  }
  const o = b.opening as { eco?: unknown; name?: unknown } | null | undefined;
  const opening = o && typeof o.eco === 'string' && typeof o.name === 'string' ? { eco: o.eco, name: o.name } : null;
  return { colour: b.colour, moves, opening };
}

/** `?colour=` (white or black; anything else means both) and `?seed=` (an integer ≥ 0, else null) of the drill page. */
export function parseDrillQuery(params: URLSearchParams): { colour: DrillColour; seed: number | null } {
  const c = params.get('colour');
  const s = params.get('seed');
  return {
    colour: c === 'white' || c === 'black' ? c : 'both',
    seed: s !== null && /^\d{1,15}$/.test(s) ? Number(s) : null,
  };
}
