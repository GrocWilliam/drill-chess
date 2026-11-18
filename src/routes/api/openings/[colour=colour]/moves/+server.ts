import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { addMove, type Colour } from '$lib/server/openings';
import type { RequestHandler } from './$types';

const body = z.object({ fromFen: z.string(), uci: z.string() });
const headers = { 'cache-control': 'no-store' };
const fail = (status: number, code: string, message: string, field?: string) =>
  json({ error: { code, message, ...(field ? { field } : {}) } }, { status, headers });

/** Adds a move to the signed-in user's repertoire of that colour. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) return fail(401, 'unauthorized', 'Sign in to edit your repertoire.');
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, 'invalid_body', 'The body must be JSON.');
  }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid_body', 'Send {fromFen, uci}.');
  const r = await addMove(locals.user.id, params.colour as Colour, parsed.data.fromFen, parsed.data.uci, new Date());
  if ('status' in r) {
    const { id, uci, san, by } = r.move;
    return json({ move: { id, uci, san, by } }, { status: r.status === 'created' ? 201 : 200, headers });
  }
  switch (r.error.code) {
    case 'illegal_move':
      return fail(400, 'illegal_move', 'That move is not legal here.', 'uci');
    case 'unknown_position':
      return fail(400, 'unknown_position', 'That position is not in your repertoire.', 'fromFen');
    case 'player_move_exists':
      return fail(409, 'player_move_exists', `Delete ${r.error.san} first to choose another move here`);
    default:
      return fail(409, 'repertoire_full', 'Your repertoire holds 2,000 moves already.');
  }
};
