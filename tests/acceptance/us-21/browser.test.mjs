// US-21 (browser): the failed import state at 375×812.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { statusLine, userWithFailedImport } from '../support/failures.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { syncButton, syncButtonSize } from '../support/sync.mjs';

let env, browser;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

describe('the failed state at 375×812', () => {
  test('the error line and games-sync-chesscom show with no sideways scroll, the button at least 44×44 px', async () => {
    const user = await userWithFailedImport(env, { site: 'chesscom', username: 'failing_rook' });
    const page = await newVisitorPage(browser, { baseUrl: env.app.url, session: user.token, viewport: VIEWPORTS.mobile });
    await page.goto(env.app.url + '/games');
    await statusLine(page).waitFor({ state: 'visible' });
    await syncButton(page, 'chesscom').waitFor({ state: 'visible' });
    const s = await syncButtonSize(page, 'chesscom');
    // 1 px tolerance for subpixel layout.
    assert.ok(s.width >= 43 && s.height >= 43, JSON.stringify(s));
    const sc = await horizontalScroll(page);
    assert.ok(sc.scrollWidth <= sc.innerWidth + 1, JSON.stringify(sc));
    await page.context().close();
  });
});
