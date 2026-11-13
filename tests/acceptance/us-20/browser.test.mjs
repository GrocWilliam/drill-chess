// US-20 (browser): the Sync buttons at 375×812 and a sync without JavaScript.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { statusText, waitForStatusText } from '../support/import-status.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { pressSync, syncButton, syncButtonSize, userWithImports } from '../support/sync.mjs';

let env, browser;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

describe('the Sync buttons at 375×812', () => {
  test('both are shown, at least 44×44 px, with no sideways scroll', async () => {
    const user = await userWithImports(env, [
      { site: 'chesscom', username: 'alpha_pawn' },
      { site: 'lichess', username: 'beta_rook' },
    ]);
    const page = await newVisitorPage(browser, { baseUrl: env.app.url, session: user.token, viewport: VIEWPORTS.mobile });
    await page.goto(env.app.url + '/games');
    for (const site of ['chesscom', 'lichess']) {
      await syncButton(page, site).waitFor({ state: 'visible' });
      const s = await syncButtonSize(page, site);
      assert.ok(s.width >= 43 && s.height >= 43, `${site}: ${JSON.stringify(s)}`);
    }
    const sc = await horizontalScroll(page);
    assert.ok(sc.scrollWidth <= sc.innerWidth + 1, JSON.stringify(sc));
    await page.context().close();
  });
});

describe('pressing Sync with JavaScript disabled', () => {
  test('starts a job: "Importing…" then the done line', async () => {
    const user = await userWithImports(env, [{ site: 'chesscom', username: 'slow_knight' }]);
    const page = await newVisitorPage(browser, { baseUrl: env.app.url, session: user.token, javaScriptEnabled: false });
    await page.goto(env.app.url + '/games');
    await pressSync(page, 'chesscom');
    await page.waitForURL((u) => u.pathname === '/games');
    assert.ok((await statusText(page)).startsWith('Importing…'), await statusText(page));
    assert.equal(await waitForStatusText(page, '0 games imported, 0 skipped'), '0 games imported, 0 skipped');
    await page.context().close();
  });
});
