// US-51 (HTTP): an analysed game on page 2 of /games. U has the fake Lichess many_pawns games (5,005, 50 per page).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { rowBadges } from '../support/games.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { openPage, userWithManyGames } from '../support/paging.mjs';
import { postAnalysis, zerosBody } from '../support/review.mjs';

// The fake's many_pawns games have the PGN `1. e4 e5`: two plies.
const MANY_PLIES = 2;

let env, user;
before(async () => {
  env = await startAppWithFakeSites();
  ({ user } = await userWithManyGames(env));
});
after(async () => env?.stop());

describe('an analysed game on another page', () => {
  test('given an analysed game on page 2, when page 1 is read then no row has a badge, and when page 2 is read then only the analysed row shows it, with the paging unchanged', async () => {
    const url = env.app.url;
    const page1 = await openPage(url, user.token);
    const page2 = await openPage(url, user.token, 'page=2');
    assert.equal(page1.rows.length, 50);
    assert.ok(page2.rows.length > 0, 'page 2 has rows');
    const target = page2.rows[0].id;

    const posted = await postAnalysis(url, user.token, target, zerosBody(MANY_PLIES));
    assert.equal(posted.status, 201, JSON.stringify(posted.body));

    const again1 = await openPage(url, user.token);
    assert.deepEqual(again1.rows.map((r) => r.id), page1.rows.map((r) => r.id));
    assert.equal(again1.nextHref, page1.nextHref);
    assert.ok(rowBadges(again1.html).every((r) => r.badges.length === 0), 'page 1 shows no badge');

    const again2 = await openPage(url, user.token, 'page=2');
    assert.deepEqual(again2.rows.map((r) => r.id), page2.rows.map((r) => r.id));
    assert.equal(again2.prevHref, page2.prevHref);
    const badged = rowBadges(again2.html).filter((r) => r.badges.length > 0);
    assert.deepEqual(badged.map((r) => r.id), [target]);
    assert.equal(badged[0].badges[0].text, '100.0');
  });
});
