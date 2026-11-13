import { error } from '@sveltejs/kit';
import { getGame, movesText } from '$lib/server/games';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const game = locals.user ? await getGame(locals.user.id, params.id) : null;
  if (!game) error(404, 'not found');
  const { pgn, userId: _u, ...rest } = game;
  return { game: { ...rest, endedAt: game.endedAt.toISOString(), moves: movesText(pgn) } };
};
