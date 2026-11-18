// Lichess tablebase: `probe(fen)` → the position's category and its moves, best first (Lichess order).
import { z } from 'zod';
import { config } from '../config';
import { GatewayError, httpGet } from './http';

const rawCategory = z.enum([
  'win',
  'unknown',
  'syzygy-win',
  'maybe-win',
  'cursed-win',
  'draw',
  'blessed-loss',
  'maybe-loss',
  'syzygy-loss',
  'loss',
]);
export type TablebaseCategory = Exclude<z.infer<typeof rawCategory>, 'syzygy-win' | 'syzygy-loss'>;

/** `syzygy-win`/`syzygy-loss` → `win`/`loss`; the others unchanged. */
export const normaliseCategory = (c: z.infer<typeof rawCategory>): TablebaseCategory =>
  c === 'syzygy-win' ? 'win' : c === 'syzygy-loss' ? 'loss' : c;

const category = rawCategory.transform(normaliseCategory);
const answer = z.object({
  category,
  moves: z.array(z.object({ uci: z.string().min(4).max(5), san: z.string().min(1), category })),
});

/** Root `category` is for the side to move; each move's `category` for the side to move after it. */
export type Probe = z.infer<typeof answer>;

/**
 * GET `{TABLEBASE_URL}/standard?fen=`, one attempt (the player waits for it and has a "Try again" control). Any
 * failure (network, non-200, invalid body) throws GatewayError.
 */
export async function probe(fen: string): Promise<Probe> {
  const base = config().TABLEBASE_URL.replace(/\/+$/, '');
  const res = await httpGet(`${base}/standard?fen=${encodeURIComponent(fen)}`, {
    headers: { Accept: 'application/json' },
    retry: false,
  });
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new GatewayError('unavailable', 'invalid tablebase body');
  }
  const parsed = answer.safeParse(raw);
  if (!parsed.success) throw new GatewayError('unavailable', 'invalid tablebase body');
  return parsed.data;
}
