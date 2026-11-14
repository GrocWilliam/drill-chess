// US-68: GET /api/stats rating series over HTTP (fixture games imported through the fake sites).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { userWithBothSites } from '../support/filters.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { requestStats } from '../support/stats.mjs';

let env, url, U;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
  U = await userWithBothSites(env);
});

describe('GET /api/stats rating', () => {
  test('each series has site, time and points with at and rating, in ascending at order', async () => {
    const r = await requestStats(url, U.token);
    assert.equal(r.status, 200);
    const series = r.body?.rating?.series;
    assert.ok(Array.isArray(series) && series.length > 0, 'at least one series');
    for (const s of series) {
      assert.ok(['chesscom', 'lichess'].includes(s.site));
      assert.equal(typeof s.time, 'string');
      assert.ok(Array.isArray(s.points) && s.points.length > 0);
      for (const p of s.points) {
        assert.equal(typeof p.rating, 'number');
        assert.ok(!Number.isNaN(Date.parse(p.at)), `at ${p.at}`);
        assert.equal(new Date(p.at).toISOString(), p.at);
      }
      const times = s.points.map((p) => Date.parse(p.at));
      assert.deepEqual(times, [...times].sort((a, b) => a - b));
    }
    const keys = series.map((s) => `${s.site}-${s.time}`);
    assert.equal(new Set(keys).size, keys.length, 'one series per site and time');
  });

  test('both sites appear, chesscom before lichess', async () => {
    const r = await requestStats(url, U.token);
    const sites = r.body.rating.series.map((s) => s.site);
    assert.ok(sites.includes('chesscom') && sites.includes('lichess'));
    assert.ok(sites.lastIndexOf('chesscom') < sites.indexOf('lichess'));
  });

  test('the series parameter is ignored: all series are returned', async () => {
    const plain = await requestStats(url, U.token);
    const picked = await requestStats(url, U.token, 'series=lichess-blitz');
    assert.equal(picked.status, 200);
    assert.deepEqual(picked.body.rating, plain.body.rating);
  });

  test('site=lichess → only Lichess series', async () => {
    const r = await requestStats(url, U.token, 'site=lichess');
    assert.ok(r.body.rating.series.length > 0);
    assert.ok(r.body.rating.series.every((s) => s.site === 'lichess'));
  });
});
