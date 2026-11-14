import { countPlies } from '../../chess/rules';

/** The `?ply` of a board page: an integer clamped to 0…plies of `pgn`; missing or not an integer → 0. */
export function plyFromQuery(raw: string | null, pgn: string): number {
  const plies = countPlies(pgn) ?? 0;
  const n = raw !== null && /^[+-]?\d+$/.test(raw.trim()) ? Number.parseInt(raw, 10) : 0;
  return Math.max(0, Math.min(plies, n));
}
