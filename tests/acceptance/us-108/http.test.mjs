// US-108: POST /api/endgames/:id/attempts against the built app.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { failAttempt, passAttempt, recordAttempt } from '../support/endgame-attempts.mjs';
import { startServer } from '../support/server.mjs';

let app, url, U;
after(async () => app?.stop());
before(async () => {
  app = await startServer();
  url = app.url;
  U = await signedUpUser(url);
});

describe('recording attempts', () => {
  test('a first pass on kq-k → 200 {attempts 1, passes 1, streak 1, mastered false}', async () => {
    const u = await signedUpUser(url);
    const r = await passAttempt(url, u.token, 'kq-k');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { attempts: 1, passes: 1, streak: 1, mastered: false });
  });

  test('then a fail → {attempts 2, passes 1, streak 0, mastered false}', async () => {
    const u = await signedUpUser(url);
    await passAttempt(url, u.token, 'kq-k');
    const r = await failAttempt(url, u.token, 'kq-k');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { attempts: 2, passes: 1, streak: 0, mastered: false });
  });

  test('3 passes on lucena → the third is mastered; a fail keeps it mastered at streak 0; a pass gives streak 1', async () => {
    const u = await signedUpUser(url);
    await passAttempt(url, u.token, 'lucena');
    const second = await passAttempt(url, u.token, 'lucena');
    assert.equal(second.body.mastered, false);
    const third = await passAttempt(url, u.token, 'lucena');
    assert.deepEqual(third.body, { attempts: 3, passes: 3, streak: 3, mastered: true });
    const fail = await failAttempt(url, u.token, 'lucena');
    assert.deepEqual(fail.body, { attempts: 4, passes: 3, streak: 0, mastered: true });
    const again = await passAttempt(url, u.token, 'lucena');
    assert.equal(again.body.streak, 1);
    assert.equal(again.body.mastered, true);
  });

  test('progress is per user', async () => {
    const a = await signedUpUser(url);
    const b = await signedUpUser(url);
    await passAttempt(url, a.token, 'kq-k');
    const r = await passAttempt(url, b.token, 'kq-k');
    assert.deepEqual(r.body, { attempts: 1, passes: 1, streak: 1, mastered: false });
  });
});

describe('errors', () => {
  test('signed out → 401 unauthorized', async () => {
    const r = await passAttempt(url, null, 'kq-k');
    assert.equal(r.status, 401);
    assert.equal(r.body.error.code, 'unauthorized');
  });

  test('unknown id → 404 not_found', async () => {
    const r = await passAttempt(url, U.token, 'no-such-id');
    assert.equal(r.status, 404);
    assert.equal(r.body.error.code, 'not_found');
  });

  test('401 comes before 404', async () => {
    const r = await passAttempt(url, null, 'no-such-id');
    assert.equal(r.status, 401);
  });

  test('non-JSON, {} and {"passed":"yes"} → 400 invalid_body and no attempt is counted', async () => {
    const u = await signedUpUser(url);
    for (const opts of [{ raw: 'not json' }, { body: {} }, { body: { passed: 'yes' } }]) {
      const r = await recordAttempt(url, u.token, 'kq-k', opts.body, opts.raw ? { raw: opts.raw } : {});
      assert.equal(r.status, 400, JSON.stringify(opts));
      assert.equal(r.body.error.code, 'invalid_body');
    }
    const ok = await passAttempt(url, u.token, 'kq-k');
    assert.deepEqual(ok.body, { attempts: 1, passes: 1, streak: 1, mastered: false });
  });

  test('404 comes before 400', async () => {
    const r = await recordAttempt(url, U.token, 'no-such-id', {}, {});
    assert.equal(r.status, 404);
  });
});
