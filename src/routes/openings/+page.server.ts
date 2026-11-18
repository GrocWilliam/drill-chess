import { summary } from '$lib/server/openings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { white, black } = await summary(locals.user!.id, new Date());
  return { white, black };
};
