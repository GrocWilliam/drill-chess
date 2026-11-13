import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  inputValue, logOut, pageText, passwordOf, redirectTarget, signUp, signedUpUser, uniqueEmail, visitAs,
} from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { pageLang, pageTheme, visit } from '../support/visitor.mjs';

let app;
before(async () => (app = await startServer()));
after(async () => app?.stop());

const THIRTY_DAYS = 30 * 24 * 3600;
const target = (r) => redirectTarget(app.url, r.location);

/** Seconds until a cookie expires, from Max-Age or Expires (null when neither). */
function lifetime(cookie) {
  if (cookie.attrs['max-age'] !== undefined) return Number(cookie.attrs['max-age']);
  if (cookie.attrs.expires !== undefined) return (Date.parse(cookie.attrs.expires) - Date.now()) / 1000;
  return null;
}

describe('signup with a valid email and password', () => {
  test('303 to /games with an HttpOnly, SameSite=Lax, Path=/, 30-day, non-Secure session cookie', async () => {
    const r = await signUp(app.url, { email: 'new.player@example.test', password: 'correct-horse-1', acceptLanguage: 'fr' });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/games');
    assert.ok(r.session, 'a session cookie is set');
    assert.ok(r.session.value.length > 0);
    assert.equal(r.session.attrs.httponly, true);
    assert.equal(String(r.session.attrs.samesite).toLowerCase(), 'lax');
    assert.equal(r.session.attrs.path, '/');
    const life = lifetime(r.session);
    assert.ok(life !== null && Math.abs(life - THIRTY_DAYS) <= 120, `lifetime ${life}s, expected ${THIRTY_DAYS}s`);
    assert.equal(r.session.attrs.secure, undefined, 'no Secure on localhost');

    const games = await visitAs(app.url, r.session.value, { path: '/games' });
    assert.equal(games.status, 200);
    assert.equal(pageLang(games.html), 'fr');
    assert.ok(pageText(games.html).includes('Vos parties'));
  });

  test('an English signup shows "Your games" on /games', async () => {
    const { token } = await signedUpUser(app.url, { acceptLanguage: 'en' });
    const games = await visitAs(app.url, token, { path: '/games' });
    assert.equal(games.status, 200);
    assert.equal(pageLang(games.html), 'en');
    assert.ok(pageText(games.html).includes('Your games'));
  });
});

describe('signup with an invalid email', () => {
  test('not-an-email gives 400, "Enter a valid email address." and no session cookie', async () => {
    const r = await signUp(app.url, { email: 'not-an-email', password: 'correct-horse-1', acceptLanguage: 'en' });
    assert.equal(r.status, 400);
    assert.ok(pageText(r.html).includes('Enter a valid email address.'));
    assert.equal(r.session, null);
  });
});

describe('password length 10 to 200', () => {
  test('9 characters gives 400 with "The password needs at least 10 characters."', async () => {
    const r = await signUp(app.url, { email: uniqueEmail(), password: passwordOf(9), acceptLanguage: 'en' });
    assert.equal(r.status, 400);
    assert.ok(pageText(r.html).includes('The password needs at least 10 characters.'));
    assert.equal(r.session, null);
  });

  test('10 characters signs up', async () => {
    const r = await signUp(app.url, { email: uniqueEmail(), password: passwordOf(10), acceptLanguage: 'en' });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/games');
    assert.ok(r.session?.value);
  });

  test('200 characters signs up', async () => {
    const r = await signUp(app.url, { email: uniqueEmail(), password: passwordOf(200), acceptLanguage: 'en' });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/games');
    assert.ok(r.session?.value);
  });

  test('201 characters gives 400 with "The password can have at most 200 characters."', async () => {
    const r = await signUp(app.url, { email: uniqueEmail(), password: passwordOf(201), acceptLanguage: 'en' });
    assert.equal(r.status, 400);
    assert.ok(pageText(r.html).includes('The password can have at most 200 characters.'));
    assert.equal(r.session, null);
  });
});

describe('email already taken', () => {
  test('a.player@example.test after A.Player@example.test gives 400 "An account already exists for this email."', async () => {
    await signedUpUser(app.url, { email: 'A.Player@example.test' });
    const r = await signUp(app.url, { email: 'a.player@example.test', password: 'correct-horse-1', acceptLanguage: 'en' });
    assert.equal(r.status, 400);
    assert.ok(pageText(r.html).includes('An account already exists for this email.'));
    assert.equal(r.session, null);
  });
});

describe('several errors at once', () => {
  test('email bad and a 5-character password show both messages and keep bad in the email field', async () => {
    const r = await signUp(app.url, { email: 'bad', password: passwordOf(5), acceptLanguage: 'en' });
    assert.equal(r.status, 400);
    const text = pageText(r.html);
    assert.ok(text.includes('Enter a valid email address.'));
    assert.ok(text.includes('The password needs at least 10 characters.'));
    assert.equal(inputValue(r.html, 'signup-email'), 'bad');
  });

  test('the error messages in French', async () => {
    const both = pageText((await signUp(app.url, { email: 'bad', password: passwordOf(5), acceptLanguage: 'fr' })).html);
    assert.ok(both.includes('Saisissez une adresse e-mail valide.'));
    assert.ok(both.includes('Le mot de passe doit contenir au moins 10 caractères.'));
    const long = await signUp(app.url, { email: uniqueEmail(), password: passwordOf(201), acceptLanguage: 'fr' });
    assert.ok(pageText(long.html).includes('Le mot de passe peut contenir au plus 200 caractères.'));
    const { email } = await signedUpUser(app.url);
    const taken = await signUp(app.url, { email, password: 'correct-horse-1', acceptLanguage: 'fr' });
    assert.equal(taken.status, 400);
    assert.ok(pageText(taken.html).includes('Un compte existe déjà pour cette adresse.'));
  });
});

describe('logout', () => {
  test('303 to /, the session cookie is cleared, and the old cookie no longer signs in', async () => {
    const { token } = await signedUpUser(app.url);
    assert.equal((await visitAs(app.url, token, { path: '/games' })).status, 200);
    const r = await logOut(app.url, token);
    assert.equal(r.status, 303);
    assert.equal(target(r), '/');
    assert.ok(r.session, 'the session cookie is set again to clear it');
    assert.ok(lifetime(r.session) !== null && lifetime(r.session) <= 0, `cleared cookie lifetime ${lifetime(r.session)}`);
    const games = await visitAs(app.url, token, { path: '/games' });
    assert.equal(games.status, 303);
    assert.equal(target(games), '/login?next=%2Fgames');
  });
});

describe('route guards for signed-out visitors', () => {
  test('GET /games?site=lichess without a cookie redirects to /login?next=%2Fgames%3Fsite%3Dlichess', async () => {
    const r = await visit(app.url, { path: '/games?site=lichess' });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/login?next=%2Fgames%3Fsite%3Dlichess');
  });

  test('GET /account without a cookie redirects to /login?next=%2Faccount', async () => {
    const r = await visit(app.url, { path: '/account' });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/login?next=%2Faccount');
  });

  test('GET /games with session=bogus redirects to /login?next=%2Fgames', async () => {
    const r = await visit(app.url, { path: '/games', cookies: { session: 'bogus' } });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/login?next=%2Fgames');
  });
});

describe('route guards for signed-in users', () => {
  test('GET /signup redirects 303 to /games', async () => {
    const { token } = await signedUpUser(app.url);
    const r = await visitAs(app.url, token, { path: '/signup' });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/games');
  });

  test('GET / redirects 303 to /games', async () => {
    const { token } = await signedUpUser(app.url);
    const r = await visitAs(app.url, token, { path: '/' });
    assert.equal(r.status, 303);
    assert.equal(target(r), '/games');
  });

  test('GET /account answers 200 with the user\'s email', async () => {
    const { email, token } = await signedUpUser(app.url);
    const r = await visitAs(app.url, token, { path: '/account' });
    assert.equal(r.status, 200);
    assert.ok(r.html.includes('data-testid="account-email"'));
    assert.ok(pageText(r.html).includes(email) || inputValue(r.html, 'account-email') === email);
  });
});

describe('signed-in preferences override cookies and Accept-Language', () => {
  test('a user who signed up in French gets French despite Accept-Language: en and lang=en', async () => {
    const { token } = await signedUpUser(app.url, { acceptLanguage: 'fr' });
    const r = await visitAs(app.url, token, { path: '/games', acceptLanguage: 'en', cookies: { lang: 'en' } });
    assert.equal(r.status, 200);
    assert.equal(pageLang(r.html), 'fr');
  });

  test('the user\'s theme (system) overrides a theme=dark cookie', async () => {
    const { token } = await signedUpUser(app.url);
    const r = await visitAs(app.url, token, { path: '/games', cookies: { theme: 'dark' } });
    assert.equal(r.status, 200);
    assert.equal(pageTheme(r.html), null);
  });
});
