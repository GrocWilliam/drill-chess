import { config } from '$lib/server/config';
import { movesText } from '$lib/server/games';
import { demoGame } from '$lib/server/review/demo';
import { plyFromQuery } from '$lib/server/review/ply';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const game = demoGame();
  return {
    game: { ...game, moves: movesText(game.pgn) },
    analysis: null,
    ply: plyFromQuery(url.searchParams.get('ply'), game.pgn),
    engineDepth: config().PUBLIC_ENGINE_DEPTH,
    orientation: 'white' as const
  };
};
