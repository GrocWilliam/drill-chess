import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { logIn, pageText, redirectTarget, signUp, signedUpUser, uniqueEmail, visitAs } from '../support/accounts.mjs';
import {
  clearsSessionCookie, deleteAccount, deleteDialogHtml, deleteDialogIsOpen, openDeleteDialog, openingTag,
} from '../support/delete-account.mjs';
import { startServer } from '../support/server.mjs';

let app;
before(async () => {
  app = await startServer();
});
after(async () => app?.stop());

describe('the delete dialog', () => {
  test('GET /account?modal=delete-account shows the open dialog with a password field and a confirm button', async () => {
    const u = await signedUpUser(app.url);
    const r = await openDeleteDialog(app.url, u.token);
    assert.equal(r.status, 200);
    assert.ok(deleteDialogIsOpen(r.html), 'modal-delete-account is not an open <dialog>');
    const inside = deleteDialogHtml(r.html);
    assert.ok(openingTag(inside, 'delete-password'), 'no delete-password in the dialog');
    assert.ok(openingTag(inside, 'delete-confirm'), 'no delete-confirm in the dialog');
  });

  test('the account page offers account-delete linking to ?modal=delete-account', async () => {
    const u = await signedUpUser(app.url);
    const r = await visitAs(app.url, u.token, { path: '/account' });
    const tag = openingTag(r.html, 'account-delete');
    assert.ok(tag, 'no account-delete');
    const href = /\bhref="([^"]*)"/.exec(tag)?.[1].replace(/&amp;/g, '&');
    assert.equal(new URL(href, app.url).search, '?modal=delete-account');
    assert.equal(new URL(href, app.url).pathname, '/account');
  });
});

describe('deleting with the right password', () => {
  test('303 to /, session cookie cleared, old cookie refused, login fails, signing up again works', async () => {
    const email = 'delete.me@example.test';
    const first = await signUp(app.url, { email, password: 'correct-horse-1' });
    assert.ok(first.session?.value, 'setup: signup failed');
    const token = first.session.value;

    const r = await deleteAccount(app.url, token, 'correct-horse-1');
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(app.url, r.location), '/');
    assert.ok(clearsSessionCookie(r.cookieLines), `session cookie not cleared: ${r.cookieLines}`);

    const games = await visitAs(app.url, token, { path: '/games' });
    assert.equal(games.status, 303);
    assert.equal(redirectTarget(app.url, games.location), '/login?next=%2Fgames');

    const login = await logIn(app.url, { email, password: 'correct-horse-1', acceptLanguage: 'en' });
    assert.equal(login.status, 400);
    assert.ok(pageText(login.html).includes('Wrong email or password.'));

    const again = await signUp(app.url, { email, password: 'correct-horse-1' });
    assert.ok(again.session?.value, `signup again gave ${again.status} without a session`);
  });

  test('the other session of the same user is signed out too', async () => {
    const u = await signedUpUser(app.url);
    const second = await logIn(app.url, { email: u.email, password: u.password });
    assert.ok(second.session?.value, 'setup: second login failed');
    assert.notEqual(second.session.value, u.token);
    const before = await visitAs(app.url, second.session.value, { path: '/account' });
    assert.equal(before.status, 200);

    const r = await deleteAccount(app.url, u.token, u.password);
    assert.equal(r.status, 303);

    const after = await visitAs(app.url, second.session.value, { path: '/account' });
    assert.equal(after.status, 303);
    assert.equal(redirectTarget(app.url, after.location), '/login?next=%2Faccount');
  });
});

describe('deleting with a wrong password', () => {
  test('400, the dialog open with "Wrong password.", the account still exists', async () => {
    const u = await signedUpUser(app.url, { acceptLanguage: 'en' });
    const r = await deleteAccount(app.url, u.token, 'not-the-password-9');
    assert.equal(r.status, 400);
    assert.ok(deleteDialogIsOpen(r.html), 'dialog is not open');
    assert.ok(pageText(deleteDialogHtml(r.html)).includes('Wrong password.'));
    assert.ok(!clearsSessionCookie(r.cookieLines));

    const still = await visitAs(app.url, u.token, { path: '/account' });
    assert.equal(still.status, 200);
    const login = await logIn(app.url, { email: u.email, password: u.password });
    assert.ok(login.session?.value, 'login with the right password failed');
  });

  test('in French the error reads "Mot de passe incorrect."', async () => {
    const u = await signedUpUser(app.url, { acceptLanguage: 'fr' });
    const r = await deleteAccount(app.url, u.token, 'not-the-password-9');
    assert.equal(r.status, 400);
    assert.ok(pageText(r.html).includes('Mot de passe incorrect.'));
  });

  test('an empty password is refused too and keeps the account', async () => {
    const u = await signedUpUser(app.url);
    const r = await deleteAccount(app.url, u.token, '');
    assert.equal(r.status, 400);
    assert.equal((await visitAs(app.url, u.token, { path: '/account' })).status, 200);
  });
});
