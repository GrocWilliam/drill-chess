import { json } from '@sveltejs/kit';
import { saveAnalysis } from '$lib/server/review';
import type { RequestHandler } from './$types';

const MESSAGES = {
  depth: 'depth must be an integer from 1 to 30.',
  evals: 'evals must hold one {cp} or {mate} per position of the game.',
  best: 'best must hold one UCI move or null per move of the game.',
  body: 'The body must be a JSON object {depth, evals, best}.',
} as const;

/** Stores the browser engine's analysis of one of the signed-in user's games; the server computes the marks. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const headers = { 'cache-control': 'no-store' };
  if (!locals.user)
    return json({ error: { code: 'unauthorized', message: 'Sign in to save an analysis.' } }, { status: 401, headers });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { error: { code: 'invalid_analysis', message: MESSAGES.body, field: 'body' } },
      { status: 400, headers },
    );
  }
  const r = await saveAnalysis(locals.user.id, params.id, body);
  if (r.ok)
    return json({ marks: r.marks, accuracyWhite: r.accuracyWhite, accuracyBlack: r.accuracyBlack }, { status: 201, headers });
  if (r.code === 'not_found')
    return json({ error: { code: 'not_found', message: 'No such game.' } }, { status: 404, headers });
  return json(
    { error: { code: 'invalid_analysis', message: MESSAGES[r.field], field: r.field } },
    { status: 400, headers },
  );
};
