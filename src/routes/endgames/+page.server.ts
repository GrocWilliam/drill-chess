import { listEndgames } from '$lib/server/endgames';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({ levels: await listEndgames(locals.user!.id) });
