import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { redirectTarget, signedUpUser, visitAs } from '../support/accounts.mjs';
import { hasTestId, linkAccount, linkRowText, madeUpName, requestCount, requestsAfter, startAppWithFakeSites } from '../support/links.mjs';

let env;
before(async () => {
  env = await startAppWithFakeSites();
});
after(async () => env?.stop());

const account = (u) => visitAs(env.app.url, u.token, { path: '/account' });
const UNKNOWN = 'This username does not exist on this site.';
const UNAVAILABLE = 'The site did not answer. Try again later.';
const INVALID = 'A username has 1 to 50 letters, digits, _ or -.';

describe('link a chess.com username', () => {
  test('303 to /account, the fake got the lowercased name with our User-Agent, the row shows the name as typed', async () => {
    const u = await signedUpUser(env.app.url);
    const name = `Alpha_Pawn_${madeUpName('').slice(0, 4)}`;
    const r = await linkAccount(env.app.url, u.token, { site: 'chesscom', username: name });
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(env.app.url, r.location), '/account');
    const asked = (await env.fake.requests()).find((q) => q.path === `/pub/player/${name.toLowerCase()}`);
    assert.ok(asked, 'the fake did not log GET /pub/player/<lowercased name>');
    assert.equal(asked.method, 'GET');
    assert.equal(asked.headers['user-agent'], 'drill-chess (contact: forge@example.test)');
    const { html } = await account(u);
    assert.ok(linkRowText(html, 'chesscom').includes(name));
    assert.ok(hasTestId(html, 'unlink-chesscom'));
    assert.ok(!hasTestId(html, 'link-chesscom-username'));
  });
});

describe('link a Lichess username', () => {
  test('the fake logged GET /api/user/Beta_Rook as typed, the row shows the name', async () => {
    const u = await signedUpUser(env.app.url);
    const name = `Beta_Rook_${madeUpName('').slice(0, 4)}`;
    const r = await linkAccount(env.app.url, u.token, { site: 'lichess', username: name });
    assert.equal(r.status, 303);
    assert.ok((await env.fake.requests()).some((q) => q.method === 'GET' && q.path === `/api/user/${name}`));
    const { html } = await account(u);
    assert.ok(linkRowText(html, 'lichess').includes(name));
    assert.ok(hasTestId(html, 'unlink-lichess'));
  });
});

describe('an unknown username', () => {
  for (const site of ['chesscom', 'lichess']) {
    test(`${site}: 400 with the message next to the field, the site stays unlinked`, async () => {
      const u = await signedUpUser(env.app.url);
      const r = await linkAccount(env.app.url, u.token, { site, username: madeUpName('nobody_') });
      assert.equal(r.status, 400);
      assert.ok(linkRowText(r.html, site).includes(UNKNOWN));
      const { html } = await account(u);
      assert.ok(hasTestId(html, `link-${site}-username`));
      assert.ok(!hasTestId(html, `unlink-${site}`));
    });
  }
});

describe('a site that does not answer', () => {
  test('502 with the message, the site stays unlinked', async () => {
    const u = await signedUpUser(env.app.url);
    const r = await linkAccount(env.app.url, u.token, { site: 'chesscom', username: madeUpName('broken_') });
    assert.equal(r.status, 502);
    assert.ok(linkRowText(r.html, 'chesscom').includes(UNAVAILABLE));
    const { html } = await account(u);
    assert.ok(hasTestId(html, 'link-chesscom-username'));
    assert.ok(!hasTestId(html, 'unlink-chesscom'));
  });
});

describe('the username format', () => {
  for (const [label, username] of [
    ['bad name!', 'bad name!'],
    ['an empty username', ''],
    ['51 characters', 'a'.repeat(51)],
  ]) {
    test(`${label}: 400 with the message and no request to the site`, async () => {
      const u = await signedUpUser(env.app.url);
      const before = await requestCount(env.fake);
      const r = await linkAccount(env.app.url, u.token, { site: 'lichess', username });
      assert.equal(r.status, 400);
      assert.ok(linkRowText(r.html, 'lichess').includes(INVALID));
      // Since US-15 a link starts an import job: the earlier tests' jobs may still fetch game archives meanwhile.
      const lookups = (await requestsAfter(env.fake, before)).filter((q) => !/\/games(\/|\?|$)/.test(q.path));
      assert.deepEqual(lookups, []);
      assert.ok(!hasTestId((await account(u)).html, 'unlink-lichess'));
    });
  }

  test('50 characters of a pass the format: the fake is queried', async () => {
    const u = await signedUpUser(env.app.url);
    const before = await requestCount(env.fake);
    const r = await linkAccount(env.app.url, u.token, { site: 'lichess', username: 'a'.repeat(50) });
    assert.notEqual(r.status, 400);
    assert.ok((await requestsAfter(env.fake, before)).some((q) => q.path === `/api/user/${'a'.repeat(50)}`));
  });
});

describe('the empty state of /games', () => {
  test('with nothing linked it offers both forms; linking from /games goes back to /games and hides it', async () => {
    const u = await signedUpUser(env.app.url);
    const first = await visitAs(env.app.url, u.token, { path: '/games' });
    assert.equal(first.status, 200);
    for (const id of ['games-empty', 'link-chesscom-username', 'link-lichess-username', 'link-chesscom-submit', 'link-lichess-submit']) {
      assert.ok(hasTestId(first.html, id), `missing ${id}`);
    }
    assert.ok(first.html.includes('Link a chess.com or Lichess username to import your games'));
    const r = await linkAccount(env.app.url, u.token, { page: '/games', site: 'chesscom', username: 'gamma_bishop' });
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(env.app.url, r.location), '/games');
    const after = await visitAs(env.app.url, u.token, { path: '/games' });
    assert.ok(!hasTestId(after.html, 'games-empty'));
  });
});
