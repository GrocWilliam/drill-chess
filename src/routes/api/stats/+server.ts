import { json } from '@sveltejs/kit';
import { getStats } from '$lib/server/stats';
import { parseStatsFilters } from '$lib/server/stats/filters';
import type { RequestHandler } from './$types';

/** The signed-in user's statistics, filtered by `site`, `time`, `period` and `openingsColour`. */
export const GET: RequestHandler = async ({ locals, url }) => {
  const headers = { 'cache-control': 'no-store' };
  if (!locals.user)
    return json({ error: { code: 'unauthorized', message: 'Sign in to see your statistics.' } }, { status: 401, headers });
  // `series` is parsed but unused here: no block of this endpoint depends on it.
  return json(await getStats(locals.user.id, parseStatsFilters(url.searchParams, new Date())), { headers });
};
