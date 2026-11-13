import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  alertTexts, contentLinkCount, currentPath, headingShown, isShown, logOutThroughMenu, openGames, openSignup,
  signUpThroughForm, tabBarGamesLink,
} from '../support/account-pages.mjs';
import { signedUpUser, uniqueEmail } from '../support/accounts.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage, undersizedTargets } from '../support/pages.mjs';
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

const page = (opts = {}) => newVisitorPage(browser, { baseUrl: app.url, acceptLanguage: 'en-US', ...opts });

describe('signup in the browser at 375×812', () => {
  for (const javaScriptEnabled of [true, false]) {
    test(`lands on /games with nav-games and nav-account, without nav-login (JavaScript ${javaScriptEnabled ? 'on' : 'off'})`, async () => {
      const p = await page({ viewport: VIEWPORTS.mobile, javaScriptEnabled });
      await openSignup(p, app.url);
      await signUpThroughForm(p, { email: uniqueEmail('browser'), password: 'correct-horse-1' });
      assert.equal(currentPath(p), '/games');
      assert.ok(await headingShown(p, 'Your games'));
      assert.ok(await isShown(p, 'nav-account'));
      assert.deepEqual(await tabBarGamesLink(p), { visible: true, text: 'Games', path: '/games' });
      assert.equal(await isShown(p, 'nav-login'), false);
      await p.context().close();
    });
  }
});

describe('logout in the browser', () => {
  test('opening nav-account and pressing nav-logout lands on / with nav-login shown', async () => {
    const { token } = await signedUpUser(app.url);
    const p = await page({ session: token });
    await openGames(p, app.url);
    assert.equal(currentPath(p), '/games');
    await logOutThroughMenu(p);
    assert.equal(currentPath(p), '/');
    assert.ok(await isShown(p, 'nav-login'));
    await p.context().close();
  });
});

describe('signup page layout', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name} ${viewport.width}×${viewport.height}: no sideways scroll, targets ≥ 44×44, links to /login and /reset`, async () => {
      const p = await page({ viewport });
      await openSignup(p, app.url);
      const s = await horizontalScroll(p);
      assert.ok(s.scrollWidth <= s.innerWidth, `scrollWidth ${s.scrollWidth} > ${s.innerWidth}`);
      assert.deepEqual(await undersizedTargets(p), []);
      assert.ok((await contentLinkCount(p, '/login')) >= 1, 'a link to /login in the card');
      assert.ok((await contentLinkCount(p, '/reset')) >= 1, 'a link to /reset in the card');
      await p.context().close();
    });

    test(`${name} ${viewport.width}×${viewport.height}: a field error is announced with role="alert"`, async () => {
      // An email already taken: a server-side error the browser's own validation cannot block.
      const { email } = await signedUpUser(app.url);
      const p = await page({ viewport });
      await openSignup(p, app.url);
      await signUpThroughForm(p, { email, password: 'correct-horse-1' });
      assert.ok((await alertTexts(p)).includes('An account already exists for this email.'));
      const s = await horizontalScroll(p);
      assert.ok(s.scrollWidth <= s.innerWidth, `scrollWidth ${s.scrollWidth} > ${s.innerWidth}`);
      assert.deepEqual(await undersizedTargets(p), []);
      await p.context().close();
    });
  }
});
