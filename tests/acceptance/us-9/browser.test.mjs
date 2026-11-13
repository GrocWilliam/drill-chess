import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  alertTexts, contentLinkCount, currentPath, headingShown, logInThroughForm, openLogin,
} from '../support/account-pages.mjs';
import { signedUpUser } from '../support/accounts.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage, undersizedTargets } from '../support/pages.mjs';
import { startServer } from '../support/server.mjs';

let app, browser, user;
before(async () => {
  app = await startServer();
  browser = await launchBrowser();
  user = await signedUpUser(app.url);
});
after(async () => {
  await browser?.close();
  await app?.stop();
});

const page = (opts = {}) => newVisitorPage(browser, { baseUrl: app.url, acceptLanguage: 'en-US', ...opts });

describe('opening /account signed out, then logging in', () => {
  for (const javaScriptEnabled of [true, false]) {
    test(`lands on /account (JavaScript ${javaScriptEnabled ? 'on' : 'off'})`, async () => {
      const p = await page({ javaScriptEnabled });
      await p.goto(app.url + '/account');
      assert.equal(currentPath(p), '/login');
      await logInThroughForm(p, user);
      assert.equal(currentPath(p), '/account');
      await p.context().close();
    });
  }
});

describe('/login in French', () => {
  test('shows "Se connecter", links to /signup and /reset, and the French error', async () => {
    const p = await page({ lang: 'fr', acceptLanguage: 'fr-FR' });
    await openLogin(p, app.url);
    assert.ok(await headingShown(p, 'Se connecter'));
    assert.ok((await contentLinkCount(p, '/signup')) >= 1);
    assert.ok((await contentLinkCount(p, '/reset')) >= 1);
    await logInThroughForm(p, { email: user.email, password: 'wrong-password-9' });
    assert.equal(currentPath(p), '/login');
    assert.ok((await alertTexts(p)).includes('E-mail ou mot de passe incorrect.'));
    await p.context().close();
  });
});

describe('login page layout', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name} ${viewport.width}×${viewport.height}: no sideways scroll, targets ≥ 44×44`, async () => {
      const p = await page({ viewport });
      await openLogin(p, app.url);
      const s = await horizontalScroll(p);
      assert.ok(s.scrollWidth <= s.innerWidth, `scrollWidth ${s.scrollWidth} > ${s.innerWidth}`);
      assert.deepEqual(await undersizedTargets(p), []);
      await p.context().close();
    });
  }
});
