// US-18: the import status line and the noscript refresh (HTTP).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { openGames } from '../support/games.mjs';
import { waitForImportEnd } from '../support/imports.mjs';
import { hasAnyRefresh, hasNoscriptRefresh, statusLine } from '../support/import-status.mjs';
import { linkAccount, startAppWithFakeSites } from '../support/links.mjs';

let env;
before(async () => { env = await startAppWithFakeSites(); });
after(async () => env?.stop());

async function userWithImport(lang, username) {
  const u = await signedUpUser(env.app.url, { acceptLanguage: lang });
  const link = await linkAccount(env.app.url, u.token, { site: 'chesscom', username });
  assert.equal(link.status, 303, 'setup: linking failed');
  return u;
}

describe('GET /games while the import runs', () => {
  test('games-status reads "Importing… 0 games" and the head holds the noscript refresh', async () => {
    const u = await userWithImport('en', 'slow_knight');
    const r = await openGames(env.app.url, u.token, { acceptLanguage: 'en' });
    assert.equal(r.status, 200);
    assert.equal(statusLine(r.html), 'Importing… 0 games');
    assert.ok(hasNoscriptRefresh(r.html), 'no <noscript><meta http-equiv="refresh" content="2"></noscript>');
  });
});

describe('GET /games after the alpha_pawn import', () => {
  let en, fr;
  before(async () => {
    en = await userWithImport('en', 'alpha_pawn');
    fr = await userWithImport('fr', 'alpha_pawn');
    for (const u of [en, fr]) assert.equal((await waitForImportEnd(env.app.url, u.token, 'chesscom'))?.status, 'done');
  });

  test('games-status reads "7 games imported, 3 skipped" and there is no refresh', async () => {
    const r = await openGames(env.app.url, en.token, { acceptLanguage: 'en' });
    assert.equal(statusLine(r.html), '7 games imported, 3 skipped');
    assert.ok(!hasAnyRefresh(r.html));
  });

  test('a French user reads "7 parties importées, 3 ignorées"', async () => {
    const r = await openGames(env.app.url, fr.token, { acceptLanguage: 'fr' });
    assert.equal(statusLine(r.html), '7 parties importées, 3 ignorées');
    assert.ok(!hasAnyRefresh(r.html));
  });
});
