import { json } from '@sveltejs/kit';
import { importStatus } from '$lib/server/games';
import type { RequestHandler } from './$types';

/** The latest import job of each site of the signed-in user (the games page polls it). */
export const GET: RequestHandler = async ({ locals }) => {
  const headers = { 'cache-control': 'no-store' };
  if (!locals.user)
    return json({ error: { code: 'unauthorized', message: 'Sign in to see your imports.' } }, { status: 401, headers });
  return json({ jobs: await importStatus(locals.user.id) }, { headers });
};
