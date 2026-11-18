import { redirect } from '@sveltejs/kit';
import { deleteMove, deletePreview, explore, type Colour } from '$lib/server/openings';
import type { Actions, PageServerLoad } from './$types';

const lineOf = (url: URL) => (url.searchParams.get('line') ?? '').split(',').filter(Boolean).slice(0, 400);

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const line = lineOf(url);
  const colour = params.colour as Colour;
  const explored = await explore(locals.user!.id, colour, line);
  const moveId = url.searchParams.get('move');
  const preview =
    url.searchParams.get('modal') === 'opening-delete' && moveId
      ? await deletePreview(locals.user!.id, colour, moveId)
      : null;
  return {
    colour,
    fen: explored.fen,
    line: explored.line,
    opening: explored.opening,
    moves: explored.moves,
    deleting: preview ? { id: moveId!, san: preview.san, count: preview.count } : null
  };
};

export const actions: Actions = {
  delete: async ({ locals, params, request, url }) => {
    const moveId = String((await request.formData()).get('moveId') ?? '');
    await deleteMove(locals.user!.id, params.colour as Colour, moveId);
    const line = lineOf(url);
    redirect(303, `/openings/${params.colour}` + (line.length ? `?line=${line.join(',')}` : ''));
  }
};
