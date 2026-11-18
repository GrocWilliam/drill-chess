import { error } from '@sveltejs/kit';
import { getEndgame } from '$lib/server/endgames';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const endgame = await getEndgame(locals.user!.id, params.id);
  if (!endgame) error(404, 'Not found');
  return { endgame };
};
