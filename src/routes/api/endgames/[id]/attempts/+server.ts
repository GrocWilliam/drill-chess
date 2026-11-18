import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { getEndgame, recordAttempt } from '$lib/server/endgames';
import type { RequestHandler } from './$types';

const body = z.object({ passed: z.boolean() });
const headers = { 'cache-control': 'no-store' };
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, { status, headers });

/** Records one attempt at an endgame position for the signed-in user. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) return fail(401, 'unauthorized', 'Sign in to record attempts.');
  if (!(await getEndgame(locals.user.id, params.id))) return fail(404, 'not_found', 'Endgame not found.');
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, 'invalid_body', 'The body must be JSON.');
  }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid_body', 'Send {passed: boolean}.');
  const progress = await recordAttempt(locals.user.id, params.id, parsed.data.passed);
  if (!progress) return fail(404, 'not_found', 'Endgame not found.');
  return json(progress, { headers });
};
