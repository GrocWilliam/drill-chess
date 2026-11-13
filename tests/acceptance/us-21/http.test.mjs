// US-21: retry rate-limited calls and report failed imports (HTTP), against the fake chess.com of
// tests/acceptance/support/fakes/ (extended: `busy_*` answer 429 once per path, `failing_*` fail their month 0 archive).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { listedGames, openGames } from '../support/games.mjs';
import { archivePath, importStatus, jobOf, jobSummary } from '../support/imports.mjs';
import { requestCount, requestsAfter, startAppWithFakeSites } from '../support/links.mjs';
import { hasTestId } from '../support/links.mjs';
import { syncGames } from '../support/sync.mjs';
import {
  arrivalsByPath, requestsAbout, statusLineIsAlert, statusLineText, timesRequested, userWithEndedImport,
  userWithFailedImport, waitUntil,
} from '../support/failures.mjs';

const FAILED_EN = 'Import failed: The site did not answer. Try again later.';
const FAILED_FR = "Échec de l'importation : Le site n'a pas répondu. Réessayez plus tard.";

let env;
before(async () => { env = await startAppWithFakeSites(); });
after(async () => env?.stop());

describe('a rate-limited site (busy_bishop)', () => {
  let user, requests;
  before(async () => {
    const n = await requestCount(env.fake);
    user = await userWithEndedImport(env, { site: 'chesscom', username: 'busy_bishop' });
    requests = requestsAbout(await requestsAfter(env.fake, n), 'busy_bishop');
  });

  test('the job ends done, imported 3, skipped 0, error null', () => {
    const j = user.job;
    assert.deepEqual(j && { status: j.status, imported: j.imported, skipped: j.skipped, error: j.error },
      { status: 'done', imported: 3, skipped: 0, error: null });
  });

  test('the fake logged each busy_bishop path twice, the second request at least 1 s after the 429', () => {
    const by = arrivalsByPath(requests);
    assert.ok(Object.keys(by).length >= 3, `paths: ${JSON.stringify(Object.keys(by))}`);
    for (const p of [archivePath('busy_bishop', -1), archivePath('busy_bishop', 0)]) {
      assert.ok(Object.keys(by).some((k) => k.replace(/\/$/, '') === p), `${p} not requested`);
    }
    for (const [path, times] of Object.entries(by)) {
      assert.equal(times.length, 2, `${path}: ${times.length} requests`);
      // 10 ms tolerance for the clocks of the two processes' timers.
      assert.ok(times[1] - times[0] >= 990, `${path}: retried after ${times[1] - times[0]} ms`);
    }
  });
});

describe('a site that fails (failing_rook)', () => {
  let user, requests, status;
  before(async () => {
    const n = await requestCount(env.fake);
    user = await userWithEndedImport(env, { site: 'chesscom', username: 'failing_rook' }, { timeoutMs: 30000 });
    requests = await requestsAfter(env.fake, n);
    status = await importStatus(env.app.url, user.token);
  });

  test('within 30 s, /api/import/status answers the one chesscom job failed, imported 3, skipped 0, site_unavailable', () => {
    assert.equal(status.status, 200);
    assert.equal(status.body?.jobs?.length, 1, JSON.stringify(status.body));
    assert.deepEqual(jobSummary(jobOf(status.body, 'chesscom')),
      { site: 'chesscom', status: 'failed', imported: 3, skipped: 0, error: 'site_unavailable' });
  });

  test('the fake logged the failing month 0 archive twice (one retry)', () => {
    assert.equal(timesRequested(requests, archivePath('failing_rook', 0)), 2);
  });

  test('/games lists the 3 games stored before the failure', async () => {
    assert.equal(listedGames((await openGames(env.app.url, user.token)).html).length, 3);
  });
});

describe('the failed job on /games', () => {
  test('games-status reads the failure, is an alert, and games-sync-chesscom shows', async () => {
    const user = await userWithFailedImport(env, { site: 'chesscom', username: 'failing_rook' });
    const html = (await openGames(env.app.url, user.token, { acceptLanguage: 'en' })).html;
    assert.equal(statusLineText(html), FAILED_EN);
    assert.ok(statusLineIsAlert(html), 'games-status has no role="alert"');
    assert.ok(hasTestId(html, 'games-sync-chesscom'), 'games-sync-chesscom missing');
  });

  test('in French it reads "Échec de l\'importation : Le site n\'a pas répondu. Réessayez plus tard."', async () => {
    const user = await userWithFailedImport(env, { site: 'chesscom', username: 'failing_rook' }, { acceptLanguage: 'fr' });
    const html = (await openGames(env.app.url, user.token, { acceptLanguage: 'fr' })).html;
    assert.equal(statusLineText(html), FAILED_FR);
    assert.ok(statusLineIsAlert(html), 'games-status has no role="alert"');
    assert.ok(hasTestId(html, 'games-sync-chesscom'), 'games-sync-chesscom missing');
  });
});

describe('retrying the failed job', () => {
  let user, sync, job, monthZero;
  before(async () => {
    user = await userWithFailedImport(env, { site: 'chesscom', username: 'failing_rook' });
    const n = await requestCount(env.fake);
    sync = await syncGames(env.app.url, user.token, 'chesscom');
    // The new job is listed once the fake saw both month 0 requests of the retry and the job ended.
    job = await waitUntil(
      async () => ({
        requests: await requestsAfter(env.fake, n),
        job: jobOf((await importStatus(env.app.url, user.token)).body, 'chesscom'),
      }),
      (v) => timesRequested(v.requests, archivePath('failing_rook', 0)) >= 2 && ['done', 'failed'].includes(v.job?.status) && v.job?.imported === 0,
    );
    monthZero = timesRequested(job.requests, archivePath('failing_rook', 0));
    job = job.job;
  });

  test('POST /games?/sync with site=chesscom answers 303 to /games', () => {
    assert.equal(sync.status, 303);
    assert.equal(new URL(sync.location, env.app.url).pathname, '/games');
  });

  test('a new job runs and the latest chesscom job is failed again with imported 0', () => {
    assert.ok(monthZero >= 1, 'the new job did not ask the site');
    assert.deepEqual(job && { status: job.status, imported: job.imported, error: job.error },
      { status: 'failed', imported: 0, error: 'site_unavailable' });
  });
});
