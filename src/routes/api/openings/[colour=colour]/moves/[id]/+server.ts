import { json } from '@sveltejs/kit';
import { deleteMove, type Colour } from '$lib/server/openings';
import type { RequestHandler } from './$types';

const headers = { 'cache-control': 'no-store' };
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, { status, headers });

/** Deletes a move of the signed-in user's repertoire and every move only reachable through it. */
export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) return fail(401, 'unauthorized', 'Sign in to edit your repertoire.');
  const r = await deleteMove(locals.user.id, params.colour as Colour, params.id);
  if (!r) return fail(404, 'not_found', 'That move is not in your repertoire.');
  return json({ removed: r.removed }, { headers });
};
