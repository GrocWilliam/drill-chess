import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { failLogins, logIn, pageText, redirectTarget, signUp, uniqueEmail } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';

let app;
const password = 'correct-horse-1';
const WRONG = 'Wrong email or password.';
const LIMITED = 'Too many failed attempts. Try again in 15 minutes.';
before(async () => { app = await startServer(); });
after(async () => app?.stop());

async function newUser(prefix = 'limit.user') {
  const email = uniqueEmail(prefix);
  const r = await signUp(app.url, { email, password });
  assert.equal(r.status, 303, 'setup: signup');
  return email;
}
const target = (r) => redirectTarget(app.url, r.location);

describe('10 wrong passwords, then the right one', () => {
  test('each failure is 400 "Wrong email or password."; the 11th, with the right password, is 429 without session', async () => {
    const email = await newUser();
    for (const r of await failLogins(app.url, email, 10)) {
      assert.equal(r.status, 400);
      assert.ok(pageText(r.html).includes(WRONG));
    }
    const r = await logIn(app.url, { email, password });
    assert.equal(r.status, 429);
    assert.ok(pageText(r.html).includes(LIMITED));
    assert.equal(r.session, null);
  });
});

describe('the limit is per lower-cased email', () => {
  test('upper-case email with the right password is 429', async () => {
    const email = await newUser();
    await failLogins(app.url, email, 10);
    const r = await logIn(app.url, { email: email.toUpperCase(), password });
    assert.equal(r.status, 429);
    assert.equal(r.session, null);
  });

  test('another user logs in correctly: 303 to /games', async () => {
    const email = await newUser();
    const other = await newUser('free.user');
    await failLogins(app.url, email, 10);
    const r = await logIn(app.url, { email: other, password });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/games');
  });
});

describe('the boundary at 10 failures', () => {
  test('9 failures: right password 303; 10th failure 400; then right password 429', async () => {
    const email = await newUser();
    await failLogins(app.url, email, 9);
    const ok = await logIn(app.url, { email, password });
    assert.equal(ok.status, 303);
    assert.equal(target(ok), '/games');
    const bad = await logIn(app.url, { email, password: 'wrong-password-9' });
    assert.equal(bad.status, 400);
    assert.ok(pageText(bad.html).includes(WRONG));
    const limited = await logIn(app.url, { email, password });
    assert.equal(limited.status, 429);
  });
});

describe('an unknown email', () => {
  test('10 failures, then the 11th is 429 with the limited message', async () => {
    const email = uniqueEmail('ghost');
    for (const r of await failLogins(app.url, email, 10)) {
      assert.equal(r.status, 400);
      assert.ok(pageText(r.html).includes(WRONG));
    }
    const r = await logIn(app.url, { email, password });
    assert.equal(r.status, 429);
    assert.ok(pageText(r.html).includes(LIMITED));
  });
});

describe('the limited message in French', () => {
  test('is shown on a 429 with Accept-Language fr', async () => {
    const email = await newUser();
    await failLogins(app.url, email, 10);
    const r = await logIn(app.url, { email, password, acceptLanguage: 'fr-FR' });
    assert.equal(r.status, 429);
    assert.ok(pageText(r.html).includes('Trop de tentatives échouées. Réessayez dans 15 minutes.'));
  });
});
