// The bundled demo game: the Opera Game (Paris 1858), public domain, shown on the public /games/demo page.
import pgn from '../../../../static/demo.pgn?raw';

export type DemoGame = { whiteName: string; blackName: string; event: string; result: string; pgn: string };

export function demoGame(): DemoGame {
  return {
    whiteName: 'Paul Morphy',
    blackName: 'Duke of Brunswick and Count Isouard',
    event: 'Paris 1858',
    result: '1-0',
    pgn,
  };
}
