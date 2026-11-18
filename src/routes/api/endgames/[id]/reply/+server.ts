import { json } from '@sveltejs/kit';
import { POSITIONS } from '$lib/server/endgames/positions';
import { reply } from '$lib/server/endgames';
import type { RequestHandler } from './$types';

const headers = { 'cache-control': 'no-store' };
const fail = (status: number, error: { code: string; message: string; field?: string }) =>
  json({ error }, { status, headers });

/** The tablebase's reply in `?fen=` for endgame `id` (cached). */
export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) return fail(401, { code: 'unauthorized', message: 'Sign in to play endgames.' });
  if (!POSITIONS.some((p) => p.id === params.id)) return fail(404, { code: 'not_found', message: 'Endgame not found.' });
  const r = await reply(params.id, url.searchParams.get('fen') ?? '');
  if ('error' in r) {
    if (r.error === 'unknown_position') return fail(404, { code: 'not_found', message: 'Endgame not found.' });
    if (r.error === 'invalid_fen')
      return fail(400, {
        code: 'invalid_fen',
        message: 'Send a valid FEN of at most 7 pieces with the app to move.',
        field: 'fen',
      });
    return fail(502, { code: 'tablebase_unavailable', message: 'The tablebase does not answer.' });
  }
  return json(r, { headers });
};
