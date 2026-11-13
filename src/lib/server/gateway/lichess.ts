// Lichess API.
import { z } from 'zod';
import { config } from '../config';
import { GatewayError, httpGet } from './http';

/** Whether the user exists. Throws GatewayError `unavailable` when the site does not answer. */
export async function userExists(username: string): Promise<boolean> {
  try {
    const res = await httpGet(`${config().LICHESS_URL}/api/user/${encodeURIComponent(username)}`);
    await res.body?.cancel();
    return true;
  } catch (e) {
    if (e instanceof GatewayError && e.kind === 'not_found') return false;
    throw e;
  }
}

const player = z.object({
  user: z.object({ name: z.string() }).optional(),
  rating: z.number().int().optional(),
  aiLevel: z.number().int().optional(),
});

/** One game of the export, the fields the import reads. */
export const lichessGame = z.object({
  id: z.string(),
  variant: z.string(),
  speed: z.string(),
  lastMoveAt: z.number(),
  winner: z.enum(['white', 'black']).optional(),
  initialFen: z.string().optional(),
  pgn: z.string().optional(),
  clock: z.object({ initial: z.number(), increment: z.number() }).optional(),
  opening: z.object({ eco: z.string().optional(), name: z.string().optional() }).optional(),
  players: z.object({ white: player, black: player }),
});
export type LichessGame = z.infer<typeof lichessGame>;
export type RawLichessGame = LichessGame | { invalid: true };

/** The user's games since `sinceMs`, one per NDJSON line; a line of an unexpected shape yields `{invalid: true}`. */
export async function* streamGames(username: string, sinceMs: number): AsyncGenerator<RawLichessGame> {
  const base = config().LICHESS_URL.replace(/\/+$/, '');
  const query = `since=${sinceMs}&pgnInJson=true&opening=true&clocks=false&evals=false`;
  const res = await httpGet(`${base}/api/games/user/${encodeURIComponent(username)}?${query}`, {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (!res.body) throw new GatewayError('unavailable');
  const decoder = new TextDecoder();
  const parse = (line: string): RawLichessGame => {
    try {
      const r = lichessGame.safeParse(JSON.parse(line));
      return r.success ? r.data : { invalid: true };
    } catch {
      return { invalid: true };
    }
  };
  let buf = '';
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += decoder.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) yield parse(line);
      }
    }
  } catch (e) {
    if (e instanceof GatewayError) throw e;
    throw new GatewayError('unavailable');
  }
  buf += decoder.decode();
  if (buf.trim()) yield parse(buf.trim());
}
