// US-17: import Lichess games (HTTP, against the fake Lichess of support/fakes/).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { expectedSiteOrder, gameDetails, hasToken, listedGames, openGame, openGames, rowSites, rowsWith } from '../support/games.mjs';
import { importStatus, jobSummary, lichessStreamRequests, queryOf, waitForImportEnd } from '../support/imports.mjs';
import { monthStartMs } from '../support/fakes/lichess-games.mjs';
import { linkAccount, requestCount, requestsAfter, startAppWithFakeSites } from '../support/links.mjs';

let env, user, list, listHtml, requests;
after(async () => env?.stop());

async function link(u, site, username) {
  const r = await linkAccount(env.app.url, u.token, { site, username });
  assert.equal(r.status, 303, `setup: linking ${site} ${username} failed`);
}

before(async () => {
  env = await startAppWithFakeSites();
  const n = await requestCount(env.fake);
  user = await signedUpUser(env.app.url);
  await link(user, 'lichess', 'beta_rook');
  await waitForImportEnd(env.app.url, user.token, 'lichess', 20000);
  requests = await requestsAfter(env.fake, n);
  listHtml = (await openGames(env.app.url, user.token, { acceptLanguage: 'en' })).html;
  list = listedGames(listHtml);
});

describe('a user who links Lichess beta_rook', () => {
  test('within 20 s /api/import/status answers lichess done, imported 6, skipped 3, error null', async () => {
    const u = await signedUpUser(env.app.url);
    await link(u, 'lichess', 'beta_rook');
    const job = await waitForImportEnd(env.app.url, u.token, 'lichess', 20000);
    assert.deepEqual(jobSummary(job), { site: 'lichess', status: 'done', imported: 6, skipped: 3, error: null });
    const r = await importStatus(env.app.url, u.token);
    assert.deepEqual(r.body.jobs.map(jobSummary), [{ site: 'lichess', status: 'done', imported: 6, skipped: 3, error: null }]);
  });
});

describe('the request the fake logged', () => {
  test('one request to /api/games/user/beta_rook, Accept application/x-ndjson, the 4 query flags, since = 1st of month -2 00:00 UTC', () => {
    const rs = lichessStreamRequests(requests, 'beta_rook');
    assert.equal(rs.length, 1);
    assert.equal(rs[0].headers.accept, 'application/x-ndjson');
    const q = queryOf(rs[0].path);
    assert.equal(q.get('pgnInJson'), 'true');
    assert.equal(q.get('opening'), 'true');
    assert.equal(q.get('clocks'), 'false');
    assert.equal(q.get('evals'), 'false');
    assert.equal(q.get('since'), String(monthStartMs(-2)));
  });
});

describe('GET /games after the import', () => {
  test('6 rows, the first (newest) shows Lichess, Blitz, 180+2, White, made_up_foe, 1610, Win and B01 Scandinavian Defense', () => {
    assert.equal(list.length, 6);
    const t = list[0].text;
    for (const token of ['Lichess', 'Blitz', '180+2', 'White', 'made_up_foe', '1610', 'Win', 'B01']) {
      assert.ok(hasToken(t, token), `"${token}" missing from: ${t}`);
    }
    assert.ok(t.includes('Scandinavian Defense'), t);
  });

  test('its /games/<id> page has game-site-link to https://lichess.org/AbCdEf12', async () => {
    assert.ok(list.length > 0, 'no games listed');
    const r = await openGame(env.app.url, user.token, list[0].id);
    assert.equal(r.status, 200);
    assert.equal(gameDetails(r.html).siteLinkHref, 'https://lichess.org/AbCdEf12');
  });

  test('the ultraBullet game shows Bullet', () => {
    const [row] = rowsWith(list, 'made_up_ultra');
    assert.ok(row, 'game not listed');
    assert.ok(hasToken(row.text, 'Bullet'), row.text);
  });

  test('the correspondence game shows Daily with no clock', () => {
    const [row] = rowsWith(list, 'made_up_daily');
    assert.ok(row, 'game not listed');
    assert.ok(hasToken(row.text, 'Daily'), row.text);
    assert.ok(!/\d\+\d|null|undefined|\b0\+0\b/.test(row.text), row.text);
  });

  test('the game without winner shows Draw', () => {
    const [row] = rowsWith(list, 'made_up_draw');
    assert.ok(row, 'game not listed');
    assert.ok(hasToken(row.text, 'Draw'), row.text);
  });

  test('the games with the standard initialFen and with the player named BETA_ROOK are listed, the skipped ones are not', () => {
    for (const o of ['made_up_stdfen', 'made_up_upper']) assert.equal(rowsWith(list, o).length, 1, o);
    for (const o of ['made_up_960', 'made_up_custom', 'made_up_old', 'made_up_old2']) assert.equal(rowsWith(list, o).length, 0, o);
  });
});

describe('a user who linked chess.com alpha_pawn and Lichess beta_rook', () => {
  test('/api/import/status lists both sites and /games shows the 13 games interleaved by date', async () => {
    const u = await signedUpUser(env.app.url);
    await link(u, 'chesscom', 'alpha_pawn');
    assert.equal((await waitForImportEnd(env.app.url, u.token, 'chesscom', 20000))?.status, 'done');
    await link(u, 'lichess', 'beta_rook');
    assert.equal((await waitForImportEnd(env.app.url, u.token, 'lichess', 20000))?.status, 'done');
    const r = await importStatus(env.app.url, u.token);
    assert.deepEqual(r.body.jobs.map((j) => j.site).sort(), ['chesscom', 'lichess']);
    const rows = listedGames((await openGames(env.app.url, u.token, { acceptLanguage: 'en' })).html);
    assert.equal(rows.length, 13);
    assert.deepEqual(rowSites(rows), expectedSiteOrder());
  });
});
