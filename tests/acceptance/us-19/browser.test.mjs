// US-19 (browser): unlink without JavaScript; the dialog at 375×812.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { waitForImportEnd } from '../support/imports.mjs';
import { linkAccount, startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { unlinkButton, unlinkConfirm, unlinkDialog, unlinkDialogTargets } from '../support/unlink.mjs';

let env, browser;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

async function lichessUser(opts) {
  const user = await signedUpUser(env.app.url);
  await linkAccount(env.app.url, user.token, { site: 'lichess', username: 'beta_rook' });
  await waitForImportEnd(env.app.url, user.token, 'lichess');
  const page = await newVisitorPage(browser, { baseUrl: env.app.url, session: user.token, ...opts });
  await page.goto(env.app.url + '/account');
  return page;
}

describe('unlinking Lichess without JavaScript', () => {
  test('pressing unlink-lichess then unlink-lichess-confirm shows the link form', async () => {
    const page = await lichessUser({ javaScriptEnabled: false });
    await unlinkButton(page, 'lichess').click();
    await unlinkConfirm(page, 'lichess').click();
    await page.waitForURL((u) => u.pathname === '/account' && !u.search);
    await page.getByTestId('link-lichess-username').waitFor({ state: 'visible' });
    await page.context().close();
  });
});

describe('the dialog at 375×812', () => {
  test('fits with no sideways scroll and its buttons are at least 44×44 px', async () => {
    const page = await lichessUser({ viewport: VIEWPORTS.mobile });
    await unlinkButton(page, 'lichess').click();
    await unlinkDialog(page, 'lichess').waitFor({ state: 'visible' });
    const s = await horizontalScroll(page);
    assert.ok(s.scrollWidth <= s.innerWidth + 1, JSON.stringify(s));
    const box = await unlinkDialog(page, 'lichess').boundingBox();
    assert.ok(box.x >= -1 && box.x + box.width <= VIEWPORTS.mobile.width + 1, JSON.stringify(box));
    const targets = await unlinkDialogTargets(page, 'lichess');
    assert.ok(targets.some((t) => t.testid === 'unlink-lichess-confirm'));
    for (const t of targets) assert.ok(t.width >= 43 && t.height >= 43, JSON.stringify(t));
    await page.context().close();
  });
});
