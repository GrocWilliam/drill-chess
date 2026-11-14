import { error } from '@sveltejs/kit';
import { config } from '$lib/server/config';
import { getGame, movesText } from '$lib/server/games';
import { getAnalysis } from '$lib/server/review';
import { plyFromQuery } from '$lib/server/review/ply';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const game = locals.user ? await getGame(locals.user.id, params.id) : null;
  if (!game || !locals.user) error(404, 'not found');
  const { userId: _u, ...rest } = game;
  const a = await getAnalysis(locals.user.id, game.id);
  return {
    game: { ...rest, endedAt: game.endedAt.toISOString(), moves: movesText(game.pgn) },
    analysis: a
      ? { evals: a.evals, best: a.best, marks: a.marks, accuracyWhite: a.accuracyWhite, accuracyBlack: a.accuracyBlack }
      : null,
    ply: plyFromQuery(url.searchParams.get('ply'), game.pgn),
    engineDepth: config().PUBLIC_ENGINE_DEPTH,
    orientation: (game.colour === 'black' ? 'black' : 'white') as 'white' | 'black'
  };
};
