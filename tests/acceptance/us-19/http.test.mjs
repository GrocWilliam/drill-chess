// US-19: unlink a username and delete that site's games (HTTP).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { pageText, redirectTarget, signedUpUser } from '../support/accounts.mjs';
import { listedGames, openGame, openGames } from '../support/games.mjs';
import { importStatus, jobOf, jobSummary, waitForImportEnd } from '../support/imports.mjs';
import { hasTestId, linkAccount, startAppWithFakeSites } from '../support/links.mjs';
import { gameIds, openAccount, openUnlinkDialog, unlinkAccount, unlinkDialogIsOpen } from '../support/unlink.mjs';

let env;
before(async () => { env = await startAppWithFakeSites(); });
after(async () => env?.stop());

async function link(u, site, username) {
  const r = await linkAccount(env.app.url, u.token, { site, username });
  assert.equal(r.status, 303, `setup: linking ${site} failed`);
  assert.equal((await waitForImportEnd(env.app.url, u.token, site))?.status, 'done', `setup: ${site} import`);
}

/** A user with chess.com alpha_pawn then Lichess beta_rook imported → { ...user, chesscomIds, lichessIds }. */
async function bothImported() {
  const u = await signedUpUser(env.app.url);
  await link(u, 'chesscom', 'alpha_pawn');
  const chesscomIds = gameIds(listedGames((await openGames(env.app.url, u.token)).html));
  await link(u, 'lichess', 'beta_rook');
  const all = gameIds(listedGames((await openGames(env.app.url, u.token)).html));
  return { ...u, chesscomIds, lichessIds: all.filter((id) => !chesscomIds.includes(id)) };
}

describe('GET /account?modal=unlink-chesscom', () => {
  test('shows the unlink dialog with unlink-chesscom-confirm', async () => {
    const u = await signedUpUser(env.app.url);
    await link(u, 'chesscom', 'alpha_pawn');
    const r = await openUnlinkDialog(env.app.url, u.token, 'chesscom');
    assert.equal(r.status, 200);
    assert.ok(unlinkDialogIsOpen(r.html, 'chesscom'), 'modal-unlink-chesscom is not an open <dialog>');
    assert.ok(hasTestId(r.html, 'unlink-chesscom-confirm'));
  });
});

describe('POST /account?/unlink with site=chesscom', () => {
  let u, result;
  before(async () => {
    u = await bothImported();
    assert.equal(u.chesscomIds.length, 7, 'setup: 7 chess.com games');
    assert.equal(u.lichessIds.length, 6, 'setup: 6 Lichess games');
    result = await unlinkAccount(env.app.url, u.token, 'chesscom');
  });

  test('answers 303 to /account', () => {
    assert.equal(result.status, 303);
    assert.equal(redirectTarget(env.app.url, result.location), '/account');
  });

  test('/account shows link-chesscom-username again', async () => {
    assert.ok(hasTestId((await openAccount(env.app.url, u.token)).html, 'link-chesscom-username'));
  });

  test('/games lists only the 6 Lichess games', async () => {
    const rows = listedGames((await openGames(env.app.url, u.token)).html);
    assert.deepEqual(gameIds(rows).sort(), [...u.lichessIds].sort());
  });

  test('a former chess.com game id answers 404 on /games/<id>', async () => {
    for (const id of u.chesscomIds) assert.equal((await openGame(env.app.url, u.token, id)).status, 404);
  });

  test('/api/import/status lists only the lichess job', async () => {
    const r = await importStatus(env.app.url, u.token);
    assert.deepEqual(r.body.jobs.map((j) => j.site), ['lichess']);
  });
});

describe('unlinking the only linked site', () => {
  test('/games shows games-empty and /api/import/status answers {"jobs": []}', async () => {
    const u = await signedUpUser(env.app.url);
    await link(u, 'lichess', 'beta_rook');
    const r = await unlinkAccount(env.app.url, u.token, 'lichess');
    assert.equal(r.status, 303);
    assert.ok(hasTestId((await openGames(env.app.url, u.token)).html, 'games-empty'));
    assert.deepEqual((await importStatus(env.app.url, u.token)).body, { jobs: [] });
  });
});

describe('linking again after unlinking', () => {
  test('the job ends done with imported: 7 (a new first import)', async () => {
    const u = await signedUpUser(env.app.url);
    await link(u, 'chesscom', 'alpha_pawn');
    assert.equal((await unlinkAccount(env.app.url, u.token, 'chesscom')).status, 303);
    const r = await linkAccount(env.app.url, u.token, { site: 'chesscom', username: 'alpha_pawn' });
    assert.equal(r.status, 303);
    const job = await waitForImportEnd(env.app.url, u.token, 'chesscom');
    assert.equal(jobSummary(job).status, 'done');
    assert.equal(job.imported, 7);
    assert.equal(listedGames((await openGames(env.app.url, u.token)).html).length, 7);
  });
});

describe('unlinking while an import runs', () => {
  test('409 "An import is already running. Wait for it to finish.", the dialog stays open and the link is kept', async () => {
    const u = await signedUpUser(env.app.url, { acceptLanguage: 'en' });
    const l = await linkAccount(env.app.url, u.token, { site: 'chesscom', username: 'slow_knight' });
    assert.equal(l.status, 303);
    const r = await unlinkAccount(env.app.url, u.token, 'chesscom');
    assert.equal(r.status, 409);
    assert.ok(pageText(r.html).includes('An import is already running. Wait for it to finish.'));
    assert.ok(unlinkDialogIsOpen(r.html, 'chesscom'), 'the dialog is not open in the 409 answer');
    assert.ok(!hasTestId((await openAccount(env.app.url, u.token)).html, 'link-chesscom-username'), 'the link was removed');
    assert.ok(jobOf((await importStatus(env.app.url, u.token)).body, 'chesscom'), 'the job was deleted');
    assert.equal((await waitForImportEnd(env.app.url, u.token, 'chesscom'))?.imported, 4);
  });

  test('a French user reads the message in French', async () => {
    const u = await signedUpUser(env.app.url, { acceptLanguage: 'fr' });
    await linkAccount(env.app.url, u.token, { site: 'chesscom', username: 'slow_knight' });
    const r = await unlinkAccount(env.app.url, u.token, 'chesscom');
    assert.equal(r.status, 409);
    assert.ok(pageText(r.html).includes('Une importation est déjà en cours. Attendez qu\'elle se termine.'));
    await waitForImportEnd(env.app.url, u.token, 'chesscom');
  });
});
