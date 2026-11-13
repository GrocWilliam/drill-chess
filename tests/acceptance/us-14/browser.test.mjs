import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { madeUpName, startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage, undersizedTargets } from '../support/pages.mjs';

let env, browser;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

const pageFor = (user, opts = {}) => newVisitorPage(browser, { baseUrl: env.app.url, session: user.token, ...opts });

describe('linking in the browser', () => {
  test('a French user at 375×812 sees the French message next to the Lichess field', async () => {
    const user = await signedUpUser(env.app.url, { acceptLanguage: 'fr' });
    const p = await pageFor(user, { lang: 'fr', acceptLanguage: 'fr-FR', viewport: VIEWPORTS.mobile });
    await p.goto(env.app.url + '/account');
    const row = p.getByTestId('link-lichess');
    await row.getByTestId('link-lichess-username').fill(madeUpName('nobody_'));
    await row.getByTestId('link-lichess-submit').click();
    await row.getByText("Ce nom d'utilisateur n'existe pas sur ce site.").waitFor();
    await p.context().close();
  });

  test('without JavaScript, linking delta_queen on /games works', async () => {
    const user = await signedUpUser(env.app.url);
    const p = await pageFor(user, { javaScriptEnabled: false });
    await p.goto(env.app.url + '/games');
    await p.getByTestId('link-chesscom-username').fill('delta_queen');
    await p.getByTestId('link-chesscom-submit').click();
    await p.waitForURL((u) => u.pathname === '/games');
    await p.getByTestId('games-empty').waitFor({ state: 'detached' });
    await p.context().close();
  });
});

describe('the /games empty state layout', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name} (${viewport.width}×${viewport.height}): no sideways scroll, targets of 44×44`, async () => {
      const user = await signedUpUser(env.app.url);
      const p = await pageFor(user, { viewport });
      await p.goto(env.app.url + '/games');
      await p.getByTestId('games-empty').waitFor();
      const s = await horizontalScroll(p);
      assert.ok(s.scrollWidth <= s.innerWidth, `scrollWidth ${s.scrollWidth} > ${s.innerWidth}`);
      assert.deepEqual(await undersizedTargets(p), []);
      for (const id of ['link-chesscom-submit', 'link-lichess-submit', 'link-chesscom-username', 'link-lichess-username']) {
        const box = await p.getByTestId(id).boundingBox();
        assert.ok(box.width >= 43 && box.height >= 43, `${id} is ${box.width}×${box.height}`);
      }
      await p.context().close();
    });
  }
});
