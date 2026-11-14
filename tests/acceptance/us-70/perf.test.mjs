// US-70: /stats with the 5,000 games imported from the fake Lichess user many_pawns answers in under 1 s.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startAppWithFakeSites } from '../support/links.mjs';
import { userWithManyGames } from '../support/paging.mjs';
import { colourRows, openStats } from '../support/stats-page.mjs';

let env, user;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
  const r = await userWithManyGames(env);
  assert.equal(r.job?.status, 'done', 'setup: the many_pawns import is done');
  user = r.user;
});

test('given 5,000 games, GET /stats after one warm-up request answers 200 in under 1 s', async () => {
  const warm = await openStats(env.app.url, user.token);
  assert.equal(warm.status, 200);
  const t0 = performance.now();
  const r = await openStats(env.app.url, user.token);
  const ms = performance.now() - t0;
  assert.equal(r.status, 200);
  assert.ok(colourRows(r.html).length > 0, 'the page shows the games');
  assert.ok(ms < 1000, `took ${Math.round(ms)} ms`);
});
