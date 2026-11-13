import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { logIn, pageText, redirectTarget, signUp, signedUpUser, uniqueEmail, visitAs } from '../support/accounts.mjs';
import { newFiles, newestMailTo, outboxFiles, resetLinkIn, waitForMailTo } from '../support/mail.mjs';
import { openResetLink, requestReset, resetLinkFor, submitNewPassword } from '../support/reset.mjs';
import { startServer } from '../support/server.mjs';

let app;
before(async () => {
  app = await startServer();
});
after(async () => app?.stop());

const SENT = 'If an account exists for this email, we sent a link.';
const INVALID = 'This reset link is invalid or has expired.';
const NEW_PASSWORD = 'brand-new-pass-2';

describe('requesting a reset for an existing user', () => {
  test('answers 200 with the message and writes exactly one mail with the link', async () => {
    const email = 'reset.user@example.test';
    await signUp(app.url, { email, password: 'correct-horse-1', acceptLanguage: 'en' });
    const before = outboxFiles(app.outbox);
    const r = await requestReset(app.url, email);
    assert.equal(r.status, 200);
    assert.ok(pageText(r.html).includes(SENT));
    const mail = await waitForMailTo(app.outbox, email);
    assert.ok(mail, 'a mail to the user is in the outbox');
    assert.equal(newFiles(app.outbox, before).length, 1);
    assert.equal(mail.to, email);
    assert.equal(mail.subject, 'drill-chess password reset');
    assert.match(mail.file, /^\d+-[0-9a-f-]{36}\.json$/);
    const link = resetLinkIn(mail.text);
    assert.ok(link, 'the text holds a reset link');
    assert.equal(link.url, `${app.url}/reset/${link.token}`);
    assert.match(link.token, /^[A-Za-z0-9_-]{43}$/);
  });

  test('the mail is in the language the user signed up with (French)', async () => {
    const user = await signedUpUser(app.url, { acceptLanguage: 'fr' });
    await requestReset(app.url, user.email);
    const mail = await waitForMailTo(app.outbox, user.email);
    assert.ok(mail);
    assert.equal(mail.subject, 'Réinitialisation du mot de passe drill-chess');
  });
});

describe('requesting a reset that cannot match an account', () => {
  for (const email of ['nobody@example.test', 'not-an-email']) {
    test(`${email}: same 200 message, nothing sent`, async () => {
      const before = outboxFiles(app.outbox);
      const r = await requestReset(app.url, email);
      assert.equal(r.status, 200);
      assert.ok(pageText(r.html).includes(SENT));
      assert.deepEqual(newFiles(app.outbox, before), []);
    });
  }
});

describe('the reset link', () => {
  test('GET shows the form, POST sets the password and starts a session', async () => {
    const user = await signedUpUser(app.url);
    const link = await resetLinkFor(app, user.email);
    const g = await openResetLink(app.url, link.token);
    assert.equal(g.status, 200);
    assert.ok(g.html.includes('data-testid="reset-password"'));
    const r = await submitNewPassword(app.url, link.token, NEW_PASSWORD);
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(app.url, r.location), '/games');
    assert.ok(r.session?.value, 'a new session cookie');
    assert.notEqual(r.session.value, user.token);
    assert.equal((await visitAs(app.url, r.session.value, { path: '/games' })).status, 200);
  });

  test('afterwards the old password and old sessions no longer work, the new password does', async () => {
    const user = await signedUpUser(app.url);
    const link = await resetLinkFor(app, user.email);
    assert.equal((await submitNewPassword(app.url, link.token, NEW_PASSWORD)).status, 303);
    const old = await logIn(app.url, { email: user.email, password: user.password });
    assert.ok(pageText(old.html).includes('Wrong email or password.'));
    assert.equal(old.session, null);
    const fresh = await logIn(app.url, { email: user.email, password: NEW_PASSWORD });
    assert.equal(fresh.status, 303);
    assert.ok(fresh.session?.value);
    const stale = await visitAs(app.url, user.token, { path: '/games' });
    assert.equal(stale.status, 303);
    assert.equal(redirectTarget(app.url, stale.location), '/login?next=%2Fgames');
  });
});

describe('an invalid link', () => {
  test('a link already used answers 400 on GET and POST with the message and a link to /reset', async () => {
    const user = await signedUpUser(app.url);
    const link = await resetLinkFor(app, user.email);
    assert.equal((await submitNewPassword(app.url, link.token, NEW_PASSWORD)).status, 303);
    const g = await openResetLink(app.url, link.token);
    assert.equal(g.status, 400);
    assert.ok(pageText(g.html).includes(INVALID));
    assert.match(g.html, /href="\/reset"/);
    const p = await submitNewPassword(app.url, link.token, 'another-pass-3');
    assert.equal(p.status, 400);
    assert.ok(pageText(p.html).includes(INVALID));
    assert.equal((await logIn(app.url, { email: user.email, password: 'another-pass-3' })).session, null);
  });

  test('/reset/unknown-token answers the same 400', async () => {
    const g = await openResetLink(app.url, 'unknown-token');
    assert.equal(g.status, 400);
    assert.ok(pageText(g.html).includes(INVALID));
    assert.match(g.html, /href="\/reset"/);
    const p = await submitNewPassword(app.url, 'unknown-token', NEW_PASSWORD);
    assert.equal(p.status, 400);
    assert.ok(pageText(p.html).includes(INVALID));
  });
});

describe('a rejected password', () => {
  test('9 characters: 400 with the message, and the same link still works afterwards', async () => {
    const user = await signedUpUser(app.url);
    const link = await resetLinkFor(app, user.email);
    const bad = await submitNewPassword(app.url, link.token, 'p'.repeat(9));
    assert.equal(bad.status, 400);
    assert.ok(pageText(bad.html).includes('The password needs at least 10 characters.'));
    assert.equal(bad.session, null);
    const ok = await submitNewPassword(app.url, link.token, NEW_PASSWORD);
    assert.equal(ok.status, 303);
    assert.equal(redirectTarget(app.url, ok.location), '/games');
  });
});
