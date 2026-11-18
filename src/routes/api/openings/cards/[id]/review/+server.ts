import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { reviewCard } from '$lib/server/openings';
import type { RequestHandler } from './$types';

const body = z.object({ correct: z.boolean() });
const headers = { 'cache-control': 'no-store' };
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, { status, headers });

/** Records a review of one of the signed-in user's cards. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) return fail(401, 'unauthorized', 'Sign in to review cards.');
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, 'invalid_body', 'The body must be JSON.');
  }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid_body', 'Send {correct: boolean}.');
  const card = await reviewCard(locals.user.id, params.id, parsed.data.correct, new Date());
  if (!card) return fail(404, 'not_found', 'Card not found.');
  return json({ card }, { headers });
};
