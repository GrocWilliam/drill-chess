import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { hiddenNext, logIn, pageText, redirectTarget, signUp, visitAs } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { visit } from '../support/visitor.mjs';

let app;
const email = 'login.user@example.test';
const password = 'correct-horse-1';
before(async () => {
  app = await startServer();
  const r = await signUp(app.url, { email, password });
  assert.equal(r.status, 303, 'setup: signup');
});
after(async () => app?.stop());

const target = (r) => redirectTarget(app.url, r.location);

describe('login with a correct email and password', () => {
  test('303 to /games with a new session cookie that opens /games', async () => {
    const r = await logIn(app.url, { email, password });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/games');
    assert.ok(r.session?.value, 'a session cookie is set');
    const games = await visitAs(app.url, r.session.value, { path: '/games' });
    assert.equal(games.status, 200);
  });

  test('the email is case-insensitive', async () => {
    const r = await logIn(app.url, { email: 'LOGIN.User@example.test', password });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/games');
    assert.ok(r.session?.value);
  });
});

describe('the next parameter', () => {
  for (const nextIn of ['query', 'form']) {
    test(`next=/games?site=lichess in the ${nextIn} redirects there`, async () => {
      const r = await logIn(app.url, { email, password, next: '/games?site=lichess', nextIn });
      assert.equal(r.status, 303);
      assert.equal(target(r), '/games?site=lichess');
    });
  }

  for (const next of ['//evil.test', 'https://evil.test', '/\\evil.test', 'games']) {
    for (const nextIn of ['query', 'form']) {
      test(`unsafe next ${JSON.stringify(next)} (${nextIn}) falls back to /games`, async () => {
        const r = await logIn(app.url, { email, password, next, nextIn });
        assert.equal(r.status, 303);
        assert.equal(r.location, '/games');
        assert.ok(r.session?.value);
      });
    }
  }

  test('GET /login?next=… keeps next in a hidden field', async () => {
    const r = await visit(app.url, { path: '/login?next=' + encodeURIComponent('/games?site=lichess') });
    assert.equal(r.status, 200);
    assert.equal(hiddenNext(r.html), '/games?site=lichess');
  });
});

describe('a failed login', () => {
  for (const [name, creds] of [
    ['a wrong password', { email, password: 'wrong-password-9' }],
    ['an unknown email', { email: 'nobody@example.test', password }],
  ]) {
    test(`${name}: 400, "Wrong email or password.", no session cookie`, async () => {
      const r = await logIn(app.url, { ...creds, acceptLanguage: 'en' });
      assert.equal(r.status, 400);
      assert.equal(r.session, null);
      assert.ok(pageText(r.html).includes('Wrong email or password.'));
    });
  }

  test('French visitors read "E-mail ou mot de passe incorrect."', async () => {
    const r = await logIn(app.url, { email, password: 'wrong-password-9', acceptLanguage: 'fr' });
    assert.equal(r.status, 400);
    assert.ok(pageText(r.html).includes('E-mail ou mot de passe incorrect.'));
  });
});

describe('a signed-in user visiting /login', () => {
  test('303 to /games', async () => {
    const l = await logIn(app.url, { email, password });
    const r = await visitAs(app.url, l.session.value, { path: '/login' });
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(app.url, r.location), '/games');
  });

  test('a signed-out visitor sees the page (200)', async () => {
    const r = await visit(app.url, { path: '/login' });
    assert.equal(r.status, 200);
  });
});
