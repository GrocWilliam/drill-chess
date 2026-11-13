import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage, undersizedTargets } from '../support/pages.mjs';
import { openAccountPage, saveLanguageThroughForm, toast, toastGoneWithin } from '../support/preferences.mjs';
import { startServer } from '../support/server.mjs';

let app, browser;
before(async () => {
  app = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await app?.stop();
});

const signedInPage = async (user, opts = {}) =>
  newVisitorPage(browser, { baseUrl: app.url, acceptLanguage: 'fr-FR', session: user.token, ...opts });

describe('saving the language in the browser', () => {
  test('with JavaScript: the page turns English, the toast shows then is gone 6 s later', async () => {
    const user = await signedUpUser(app.url, { acceptLanguage: 'fr' });
    const p = await signedInPage(user);
    await openAccountPage(p, app.url);
    await saveLanguageThroughForm(p, 'en');
    assert.equal(await p.locator('html').getAttribute('lang'), 'en');
    await toast(p).waitFor({ state: 'visible' });
    assert.equal((await toast(p).innerText()).trim(), 'Preferences saved.');
    assert.equal(await toast(p).getAttribute('role'), 'status');
    assert.ok(await toastGoneWithin(p, 6000), 'toast still visible after 6 s');
    await p.context().close();
  });

  test('without JavaScript the save works too', async () => {
    const user = await signedUpUser(app.url, { acceptLanguage: 'fr' });
    const p = await signedInPage(user, { javaScriptEnabled: false });
    await openAccountPage(p, app.url);
    await saveLanguageThroughForm(p, 'en');
    assert.equal(await p.locator('html').getAttribute('lang'), 'en');
    assert.equal((await toast(p).innerText()).trim(), 'Preferences saved.');
    await p.context().close();
  });
});

describe('the account page layout', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name} (${viewport.width}×${viewport.height}): no sideways scroll, targets of 44×44`, async () => {
      const user = await signedUpUser(app.url, { acceptLanguage: 'en' });
      const p = await signedInPage(user, { viewport, acceptLanguage: 'en-US' });
      await openAccountPage(p, app.url);
      await p.getByTestId('account-save').waitFor();
      const s = await horizontalScroll(p);
      assert.ok(s.scrollWidth <= s.innerWidth, `scrollWidth ${s.scrollWidth} > ${s.innerWidth}`);
      assert.deepEqual(await undersizedTargets(p), []);
      for (const id of ['account-lang', 'account-theme', 'account-save']) {
        const box = await p.getByTestId(id).boundingBox();
        assert.ok(box.width >= 43 && box.height >= 43, `${id} is ${box.width}×${box.height}`);
      }
      await p.context().close();
    });
  }
});
