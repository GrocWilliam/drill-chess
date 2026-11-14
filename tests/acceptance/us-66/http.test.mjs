// US-66: GET /api/stats over HTTP against the built app, with the fixture games imported through the fake
// chess.com (alpha_pawn, 7 games) and the fake Lichess (beta_rook, 6 games) of tests/acceptance/support/fakes/.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { userWithBothSites } from '../support/filters.mjs';
import { rowBadges, openGames } from '../support/games.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { G_NUMBER, gameIdByNumber, postAnalysis, zerosBodyOf } from '../support/review.mjs';
import { gamesIn, listedGamesOf, requestStats } from '../support/stats.mjs';

let env, url, U;
after(async () => env?.stop());

before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
  U = await userWithBothSites(env);
});

describe('signed out', () => {
  test('given no session cookie, GET /api/stats → 401 {"error":{"code":"unauthorized","message":<string>}}', async () => {
    const r = await requestStats(url, null);
    assert.equal(r.status, 401);
    assert.match(r.contentType, /application\/json/);
    assert.equal(r.body?.error?.code, 'unauthorized');
    assert.equal(typeof r.body?.error?.message, 'string');
  });

  test('given an unknown session cookie, GET /api/stats → 401 unauthorized', async () => {
    const r = await requestStats(url, 'not-a-session-token');
    assert.equal(r.status, 401);
    assert.equal(r.body?.error?.code, 'unauthorized');
  });
});

describe('signed in with imported games', () => {
  test('GET /api/stats → 200 JSON with the keys colour, openings, time, rating, mistakes', async () => {
    const r = await requestStats(url, U.token);
    assert.equal(r.status, 200);
    assert.match(r.contentType, /application\/json/);
    for (const key of ['colour', 'openings', 'time', 'rating', 'mistakes']) assert.ok(key in (r.body ?? {}), `no key ${key}`);
  });

  test('GET /api/stats: the sum of games over colour equals the number of the user’s games', async () => {
    const listed = await listedGamesOf(url, U.token);
    assert.equal(listed.length, 13, 'setup: the 13 fixture games are imported');
    const r = await requestStats(url, U.token);
    assert.equal(r.status, 200);
    assert.equal(gamesIn(r.body.colour), listed.length);
  });

  test('GET /api/stats?site=lichess: the counts cover only the Lichess games', async () => {
    // beta_rook's 6 games: as White 3 wins; as Black a win, a draw, a loss.
    // By time class: bullet 1 win, blitz 2 wins, rapid a draw and a loss, daily 1 win.
    const lichessListed = await listedGamesOf(url, U.token, 'site=lichess');
    const r = await requestStats(url, U.token, 'site=lichess');
    assert.equal(r.status, 200);
    assert.equal(gamesIn(r.body.colour), lichessListed.length);
    assert.deepEqual(r.body.colour, [
      { colour: 'white', games: 3, wins: 3, draws: 0, losses: 0, score: 100 },
      { colour: 'black', games: 3, wins: 1, draws: 1, losses: 1, score: 50 },
    ]);
    assert.deepEqual(r.body.time.map((t) => t.time), ['bullet', 'blitz', 'rapid', 'daily']);
    assert.equal(gamesIn(r.body.time), 6);
    const rapid = r.body.time.find((t) => t.time === 'rapid');
    assert.deepEqual(
      { games: rapid.games, wins: rapid.wins, draws: rapid.draws, losses: rapid.losses, score: rapid.score },
      { games: 2, wins: 0, draws: 1, losses: 1, score: 25 },
    );
  });

  test('GET /api/stats?site=foo&time=hyper&period=7d answers the same as GET /api/stats', async () => {
    const plain = await requestStats(url, U.token);
    const unknown = await requestStats(url, U.token, 'site=foo&time=hyper&period=7d');
    assert.equal(plain.status, 200);
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.body, plain.body);
  });
});

describe('read only', () => {
  test('no game or analysis of the user changes after GET /api/stats', async () => {
    const gameId = await gameIdByNumber(url, U.token, G_NUMBER);
    const saved = await postAnalysis(url, U.token, gameId, zerosBodyOf(G_NUMBER));
    assert.equal(saved.status, 201, 'setup: the analysis of G is stored');
    const snapshot = async () => ({
      games: await listedGamesOf(url, U.token),
      analysed: rowBadges((await openGames(url, U.token, { acceptLanguage: 'en' })).html),
    });
    const before = await snapshot();
    for (const q of ['', 'site=lichess', 'time=blitz&period=30d', 'period=365d&openingsColour=black&series=lichess-blitz']) {
      const r = await requestStats(url, U.token, q);
      assert.equal(r.status, 200, `GET /api/stats?${q}`);
    }
    assert.deepEqual(await snapshot(), before);
  });
});
