import { nextLine, type Colour } from '$lib/server/openings';
import { parseDrillQuery } from '$lib/components/opening-drill';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const { colour, seed } = parseDrillQuery(url.searchParams);
  const colours: Colour[] = colour === 'both' ? ['white', 'black'] : [colour];
  const first = await nextLine(locals.user!.id, colours, new Date(), seed ?? undefined);
  return { colour, seed, first };
};
