// US-15: run import jobs and import chess.com games (HTTP, against the fake chess.com of support/fakes/).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import {
  archivePath,
  archiveRequestPaths,
  importStatus,
  jobSummary,
  pathsStartingWith,
  waitForImportEnd,
} from '../support/imports.mjs';
import { linkAccount, madeUpName, requestCount, requestsAfter, startAppWithFakeSites } from '../support/links.mjs';

let env;
before(async () => {
  env = await startAppWithFakeSites();
});
after(async () => env?.stop());

const linkChesscom = (u, username) => linkAccount(env.app.url, u.token, { site: 'chesscom', username });

describe('GET /api/import/status signed out', () => {
  test('401 with JSON {"error": {"code": "unauthorized", "message": <string>}}', async () => {
    const r = await importStatus(env.app.url);
    assert.equal(r.status, 401);
    assert.match(r.contentType, /^application\/json/);
    assert.equal(r.body?.error?.code, 'unauthorized');
    assert.equal(typeof r.body.error.message, 'string');
    assert.ok(r.body.error.message.length > 0);
  });
});

describe('GET /api/import/status with nothing linked', () => {
  test('200 {"jobs": []}', async () => {
    const u = await signedUpUser(env.app.url);
    const r = await importStatus(env.app.url, u.token);
    assert.equal(r.status, 200);
    assert.match(r.contentType, /^application\/json/);
    assert.deepEqual(r.body, { jobs: [] });
  });
});

describe('linking chess.com alpha_pawn imports its games', () => {
  test('within 20 s the status is done, imported 7 (with the game naming ALPHA_PAWN), skipped 3, error null', async () => {
    const u = await signedUpUser(env.app.url);
    const link = await linkChesscom(u, 'alpha_pawn');
    assert.equal(link.status, 303, 'setup: linking alpha_pawn failed');
    const job = await waitForImportEnd(env.app.url, u.token, 'chesscom', 20000);
    assert.deepEqual(jobSummary(job), { site: 'chesscom', status: 'done', imported: 7, skipped: 3, error: null });
    const r = await importStatus(env.app.url, u.token);
    assert.equal(r.status, 200);
    assert.deepEqual(jobSummary(r.body.jobs.find((j) => j.site === 'chesscom')), {
      site: 'chesscom', status: 'done', imported: 7, skipped: 3, error: null,
    });
  });

  test('the fake got archive requests for exactly the current UTC month and the 2 previous, none for month -3 or /other/path', async () => {
    const before = await requestCount(env.fake);
    const u = await signedUpUser(env.app.url);
    assert.equal((await linkChesscom(u, 'alpha_pawn')).status, 303, 'setup: linking alpha_pawn failed');
    const job = await waitForImportEnd(env.app.url, u.token, 'chesscom', 20000);
    assert.equal(job?.status, 'done');
    const requests = await requestsAfter(env.fake, before);
    const expected = [0, -1, -2].map((o) => archivePath('alpha_pawn', o));
    assert.deepEqual(archiveRequestPaths(requests).sort(), [...expected].sort());
    assert.ok(!archiveRequestPaths(requests).includes(archivePath('alpha_pawn', -3)));
    assert.deepEqual(pathsStartingWith(requests, '/other/path'), []);
  });

  test('when an archive does not answer, the job ends failed with site_unavailable and keeps the games of the earlier archive', async () => {
    const u = await signedUpUser(env.app.url);
    assert.equal((await linkChesscom(u, madeUpName('stalled_'))).status, 303, 'setup: linking failed');
    const job = await waitForImportEnd(env.app.url, u.token, 'chesscom', 20000);
    assert.equal(job?.status, 'failed');
    assert.equal(job.error, 'site_unavailable');
    assert.equal(job.imported, 2);
  });
});

describe('two users who both link alpha_pawn', () => {
  test('each user\'s status shows imported: 7 (games are unique per user)', async () => {
    const first = await signedUpUser(env.app.url);
    const second = await signedUpUser(env.app.url);
    assert.equal((await linkChesscom(first, 'alpha_pawn')).status, 303, 'setup: linking failed');
    assert.equal((await linkChesscom(second, 'alpha_pawn')).status, 303, 'setup: linking failed');
    const a = await waitForImportEnd(env.app.url, first.token, 'chesscom', 20000);
    const b = await waitForImportEnd(env.app.url, second.token, 'chesscom', 20000);
    assert.equal(a?.status, 'done');
    assert.equal(a.imported, 7);
    assert.equal(b?.status, 'done');
    assert.equal(b.imported, 7);
  });
});
