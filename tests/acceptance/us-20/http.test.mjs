// US-20: sync new games and refuse a second import while one runs (HTTP).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { lastMoveAtOf } from '../support/fakes/lichess-games.mjs';
import { hasToken, listedGames, openGames } from '../support/games.mjs';
import {
  archivePath, archiveRequestPaths, jobOf, importStatus, jobSummary, lichessStreamRequests, queryOf, waitForImportEnd,
} from '../support/imports.mjs';
import { linkAccount, requestCount, requestsAfter, startAppWithFakeSites, textOf } from '../support/links.mjs';
import { pageText } from '../support/accounts.mjs';
import { syncButtonCount, syncButtonLabel, syncGames, userWithImports } from '../support/sync.mjs';

const RUNNING = 'An import is already running. Wait for it to finish.';
let env;
before(async () => { env = await startAppWithFakeSites(); });
after(async () => env?.stop());

const rowsOf = async (u) => listedGames((await openGames(env.app.url, u.token)).html);

describe('sync chess.com', () => {
  let user, before1, newGame, firstSync, job, rows, requests;
  before(async () => {
    user = await userWithImports(env, [{ site: 'chesscom', username: 'alpha_pawn' }]);
    assert.equal((await rowsOf(user)).length, 7, 'setup: first import');
    await env.fake.addGame('chesscom', 'alpha_pawn', { id: '96000001', opponent: 'made_up_newcomer' });
    before1 = await requestCount(env.fake);
    firstSync = await syncGames(env.app.url, user.token, 'chesscom');
    // The job row exists when the 303 is sent, so the latest job is the sync.
    job = await waitForImportEnd(env.app.url, user.token, 'chesscom');
    requests = await requestsAfter(env.fake, before1);
    rows = await rowsOf(user);
  });

  test('POST /games?/sync answers 303 to /games', () => {
    assert.equal(firstSync.status, 303);
    assert.equal(new URL(firstSync.location, env.app.url).pathname, '/games');
  });

  test('the sync imports the new game: done, imported 1, skipped 0, and /games shows 8 rows, the new game first', () => {
    assert.deepEqual({ status: job.status, imported: job.imported, skipped: job.skipped, error: job.error },
      { status: 'done', imported: 1, skipped: 0, error: null });
    assert.equal(rows.length, 8);
    assert.ok(hasToken(rows[0].text, 'made_up_newcomer'), rows[0].text);
  });

  test('the fake only got the archive of the current month, the month of the newest stored game', () => {
    assert.deepEqual(archiveRequestPaths(requests).map((p) => p.replace(/\/$/, '')), [archivePath('alpha_pawn', 0)]);
  });

  test('syncing again with no new game ends done with imported 0 and /games still shows 8 rows', async () => {
    const r = await syncGames(env.app.url, user.token, 'chesscom');
    assert.equal(r.status, 303);
    const j = await waitForImportEnd(env.app.url, user.token, 'chesscom');
    assert.equal(j.status, 'done');
    assert.equal(j.imported, 0);
    assert.equal((await rowsOf(user)).length, 8);
  });
});

describe('sync Lichess', () => {
  test('the request has since = the newest stored game + 1, imported 1, and /games shows 7 rows', async () => {
    const user = await userWithImports(env, [{ site: 'lichess', username: 'beta_rook' }]);
    assert.equal((await rowsOf(user)).length, 6, 'setup: first import');
    await env.fake.addGame('lichess', 'beta_rook', { id: 'FreshGm01', opponent: 'made_up_fresh' });
    const n = await requestCount(env.fake);
    const r = await syncGames(env.app.url, user.token, 'lichess');
    assert.equal(r.status, 303);
    const job = await waitForImportEnd(env.app.url, user.token, 'lichess');
    assert.equal(job.status, 'done');
    assert.equal(job.imported, 1);
    const reqs = lichessStreamRequests(await requestsAfter(env.fake, n), 'beta_rook');
    assert.equal(reqs.length, 1);
    assert.equal(queryOf(reqs[0].path).get('since'), String(lastMoveAtOf('AbCdEf12') + 1));
    assert.equal((await rowsOf(user)).length, 7);
  });
});

describe('while an import runs', () => {
  let user;
  before(async () => {
    user = await signedUpUser(env.app.url);
    const r = await linkAccount(env.app.url, user.token, { site: 'chesscom', username: 'slow_knight' });
    assert.equal(r.status, 303, 'setup: link');
  });

  test('a sync answers 409 import_running', async () => {
    const r = await syncGames(env.app.url, user.token, 'chesscom');
    assert.equal(r.status, 409);
    assert.ok(pageText(r.html).includes(RUNNING), 'message missing');
  });

  test('a link answers 409 with the same message', async () => {
    const r = await linkAccount(env.app.url, user.token, { page: '/games', site: 'lichess', username: 'beta_rook' });
    assert.equal(r.status, 409);
    assert.ok(pageText(r.html).includes(RUNNING), 'message missing');
  });
});

describe('a site that is not linked', () => {
  let user;
  before(async () => { user = await userWithImports(env, [{ site: 'chesscom', username: 'alpha_pawn' }]); });

  test('a sync of Lichess answers 400', async () => {
    assert.equal((await syncGames(env.app.url, user.token, 'lichess')).status, 400);
  });

  test('/games shows one Sync button per linked site only', async () => {
    const html = (await openGames(env.app.url, user.token, { acceptLanguage: 'en' })).html;
    assert.equal(syncButtonCount(html, 'chesscom'), 1);
    assert.equal(syncButtonLabel(html, 'chesscom'), 'Sync');
    assert.equal(syncButtonCount(html, 'lichess'), 0);
  });

  test('a French user reads "Synchroniser"', async () => {
    const fr = await userWithImports(env, [{ site: 'chesscom', username: 'someone_else' }], { acceptLanguage: 'fr' });
    const html = (await openGames(env.app.url, fr.token, { acceptLanguage: 'fr' })).html;
    assert.equal(syncButtonLabel(html, 'chesscom'), 'Synchroniser');
  });
});
