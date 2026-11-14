// US-69: GET /api/stats `mistakes` over HTTP against the built app, the games imported through the fake chess.com
// (alpha_pawn) of tests/acceptance/support/fakes/ and one analysis saved through POST /api/games/[id]/analysis.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { WHITE_GAME, dropBodyOf, gameIdByNumber, importAlphaPawn, postAnalysis } from '../support/review.mjs';
import { requestStats } from '../support/stats.mjs';

let env, url;
after(async () => env?.stop());

before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
});

describe('mistakes through the API', () => {
  test('a user who imported games and saved an analysis of one → GET /api/stats mistakes.games 1, accuracy = the stored accuracy of the user’s colour, one decimal', async () => {
    const u = await signedUpUser(url);
    await importAlphaPawn(url, u);
    // In WHITE_GAME the user plays White; White's first move loses 300 cp, so accuracyWhite is below 100.
    const gameId = await gameIdByNumber(url, u.token, WHITE_GAME);
    const saved = await postAnalysis(url, u.token, gameId, dropBodyOf(WHITE_GAME, -300));
    assert.equal(saved.status, 201, 'setup: the analysis is stored');
    const r = await requestStats(url, u.token);
    assert.equal(r.status, 200);
    assert.equal(r.body.mistakes.games, 1);
    assert.equal(r.body.mistakes.accuracy, Math.round(saved.body.accuracyWhite * 10) / 10);
  });
});
