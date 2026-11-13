import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { alertTexts, currentPath, logInThroughForm, openLogin } from '../support/account-pages.mjs';
import { failLogins, signedUpUser } from '../support/accounts.mjs';
import { launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { startServer } from '../support/server.mjs';

let app, browser, user;
before(async () => {
  app = await startServer();
  browser = await launchBrowser();
  user = await signedUpUser(app.url);
  await failLogins(app.url, user.email, 10);
});
after(async () => {
  await browser?.close();
  await app?.stop();
});

describe('a limited email in French', () => {
  test('the login form shows "Trop de tentatives échouées. Réessayez dans 15 minutes."', async () => {
    const p = await newVisitorPage(browser, { baseUrl: app.url, lang: 'fr', acceptLanguage: 'fr-FR' });
    await openLogin(p, app.url);
    await logInThroughForm(p, user);
    assert.equal(currentPath(p), '/login');
    assert.ok((await alertTexts(p)).includes('Trop de tentatives échouées. Réessayez dans 15 minutes.'));
    await p.context().close();
  });
});
