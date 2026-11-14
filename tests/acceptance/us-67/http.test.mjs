// US-67: GET /api/stats?openingsColour= over HTTP, fixture games imported through the fake chess.com and Lichess.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { userWithBothSites } from '../support/filters.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { gamesIn, requestOpenings } from '../support/stats.mjs';

let env, url, U;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
  U = await userWithBothSites(env);
});

const blackGames = (colour) => colour.find((c) => c.colour === 'black')?.games ?? 0;
const whiteGames = (colour) => colour.find((c) => c.colour === 'white')?.games ?? 0;

describe('GET /api/stats?openingsColour=', () => {
  test('openingsColour=black: every openings row counts only games where the user had Black', async () => {
    // site=lichess keeps the groups under 10 rows, so nothing is cut off: the rows add up to the Black games.
    const r = await requestOpenings(url, U.token, 'site=lichess&openingsColour=black');
    assert.equal(r.status, 200);
    assert.equal(gamesIn(r.rows), 3);
    assert.equal(blackGames(r.colour), 3);
    assert.equal(whiteGames(r.colour), 3, 'colour is not filtered by openingsColour');
    for (const row of r.rows) {
      assert.equal(row.games, row.wins + row.draws + row.losses);
      assert.equal(typeof row.score, 'number');
    }
    const all = await requestOpenings(url, U.token, 'openingsColour=black');
    assert.ok(all.rows.length <= 10);
    assert.ok(gamesIn(all.rows) <= blackGames(all.colour));
  });

  test('openingsColour=white counts only the White games, both counts all of them', async () => {
    const w = await requestOpenings(url, U.token, 'site=lichess&openingsColour=white');
    const b = await requestOpenings(url, U.token, 'site=lichess&openingsColour=both');
    assert.equal(gamesIn(w.rows), 3);
    assert.equal(gamesIn(b.rows), 6);
  });

  test('openingsColour=red gives the same openings as both', async () => {
    for (const base of ['', 'site=lichess&']) {
      const red = await requestOpenings(url, U.token, `${base}openingsColour=red`);
      const both = await requestOpenings(url, U.token, `${base}openingsColour=both`);
      assert.equal(red.status, 200);
      assert.ok(Array.isArray(both.rows) && both.rows.length > 0);
      assert.deepEqual(red.rows, both.rows);
    }
  });
});
