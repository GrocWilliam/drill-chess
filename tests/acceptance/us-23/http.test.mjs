// US-23: page through the games list and cap an account at 5,000 games (HTTP, fake Lichess user many_pawns).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { jobSummary } from '../support/imports.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { openPage, rowSiteLinks, siteLinkOf, isBlitzRow, userWithManyGames } from '../support/paging.mjs';

let env, user, job, page1;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
  ({ user, job } = await userWithManyGames(env));
  page1 = await openPage(env.app.url, user.token);
});

const get = (q) => openPage(env.app.url, user.token, q);
const range = (from, to) => Array.from({ length: from - to + 1 }, (_, i) => from - i);
const links = async (r) => rowSiteLinks(env.app.url, user.token, r.rows);
const nextUrl = (r) => new URL(r.nextHref, 'http://x');

describe('the import of many_pawns', () => {
  test('the job ends as done with 5005 imported, 0 skipped and no error', () => {
    assert.deepEqual(jobSummary(job), { site: 'lichess', status: 'done', imported: 5005, skipped: 0, error: null });
  });
});

describe('GET /games', () => {
  test('shows 50 rows, the first being mp005005, with games-next to page 2 and no games-prev', async () => {
    assert.equal(page1.status, 200);
    assert.equal(page1.rows.length, 50);
    assert.equal((await rowSiteLinks(env.app.url, user.token, page1.rows.slice(0, 1)))[0], siteLinkOf(5005));
    assert.ok(page1.nextHref, 'games-next is missing');
    assert.equal(nextUrl(page1).pathname, '/games');
    assert.equal(nextUrl(page1).searchParams.get('page'), '2');
    assert.equal(page1.prevHref, null);
  });
});

describe('GET /games?page=2', () => {
  test('shows mp004955 down to mp004906, with games-prev and games-next', async () => {
    const r = await get('page=2');
    assert.equal(r.rows.length, 50);
    assert.deepEqual(await links(r), range(4955, 4906).map(siteLinkOf));
    assert.ok(r.prevHref, 'games-prev is missing');
    assert.ok(r.nextHref, 'games-next is missing');
    assert.equal(nextUrl(r).searchParams.get('page'), '3');
  });
});

describe('GET /games?page=100', () => {
  test('shows 50 rows ending with mp000006 and no games-next', async () => {
    const r = await get('page=100');
    assert.equal(r.rows.length, 50);
    assert.deepEqual(await links(r), range(55, 6).map(siteLinkOf));
    assert.ok(r.prevHref, 'games-prev is missing');
    assert.equal(r.nextHref, null);
    assert.equal(r.hasNone, false);
  });
});

describe('a page past the last, or not a positive integer', () => {
  test('?page=101 shows games-none', async () => {
    const r = await get('page=101');
    assert.equal(r.status, 200);
    assert.equal(r.hasNone, true);
    assert.equal(r.rows.length, 0);
  });
  for (const bad of ['0', '-3', 'abc']) {
    test(`?page=${bad} shows page 1`, async () => {
      const r = await get(`page=${bad}`);
      assert.equal(r.status, 200);
      assert.equal(r.hasNone, false);
      assert.deepEqual(r.rows.map((x) => x.id), page1.rows.map((x) => x.id));
      assert.equal(r.prevHref, null);
      assert.ok(r.nextHref);
    });
  }
});

describe('paging with a filter', () => {
  test('?time=blitz&page=2 keeps time=blitz in games-prev and games-next, and lists only blitz games', async () => {
    const r = await get('time=blitz&page=2');
    assert.equal(r.rows.length, 50);
    assert.ok(r.rows.every(isBlitzRow), 'a row is not a blitz game');
    assert.ok(r.prevHref && r.nextHref, 'a paging link is missing');
    const next = nextUrl(r);
    const prev = new URL(r.prevHref, 'http://x');
    assert.equal(next.searchParams.get('time'), 'blitz');
    assert.equal(next.searchParams.get('page'), '3');
    assert.equal(prev.searchParams.get('time'), 'blitz');
    assert.ok([null, '1'].includes(prev.searchParams.get('page')));
  });
});
