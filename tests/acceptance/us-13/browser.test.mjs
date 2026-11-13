import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { currentPath } from '../support/account-pages.mjs';
import {
  confirmDeletion, deleteDialog, dialogBox, dialogTargets, openAccountDeleteLink,
} from '../support/delete-account.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
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
  newVisitorPage(browser, { baseUrl: app.url, acceptLanguage: 'en-US', session: user.token, ...opts });

describe('deleting the account in the browser', () => {
  test('without JavaScript: follow account-delete, type the password, confirm → on / signed out', async () => {
    const user = await signedUpUser(app.url);
    const p = await signedInPage(user, { javaScriptEnabled: false });
    await p.goto(app.url + '/account');
    await openAccountDeleteLink(p).click();
    await p.waitForURL((u) => u.searchParams.get('modal') === 'delete-account');
    await deleteDialog(p).waitFor({ state: 'visible' });
    await confirmDeletion(p, user.password);
    await p.waitForURL((u) => u.pathname === '/');
    assert.equal(currentPath(p), '/');
    await p.goto(app.url + '/games');
    assert.equal(currentPath(p), '/login');
    await p.context().close();
  });

  test('with JavaScript: account-delete opens the same dialog, and confirming signs out', async () => {
    const user = await signedUpUser(app.url);
    const p = await signedInPage(user);
    await p.goto(app.url + '/account');
    await openAccountDeleteLink(p).click();
    await deleteDialog(p).waitFor({ state: 'visible' });
    assert.ok(await p.getByTestId('delete-password').isVisible());
    assert.ok(await p.getByTestId('delete-confirm').isVisible());
    await confirmDeletion(p, user.password);
    await p.waitForURL((u) => u.pathname === '/');
    await p.goto(app.url + '/games');
    assert.equal(currentPath(p), '/login');
    await p.context().close();
  });
});

describe('the dialog at 375×812', () => {
  test('fits the viewport, no sideways scroll, buttons of at least 44×44', async () => {
    const user = await signedUpUser(app.url);
    const p = await signedInPage(user, { viewport: VIEWPORTS.mobile });
    await p.goto(app.url + '/account?modal=delete-account');
    await deleteDialog(p).waitFor({ state: 'visible' });
    const s = await horizontalScroll(p);
    assert.ok(s.scrollWidth <= s.innerWidth, `scrollWidth ${s.scrollWidth} > ${s.innerWidth}`);
    const box = await dialogBox(p);
    assert.ok(box.x >= -1 && box.x + box.width <= 376, `dialog horizontally at ${box.x}..${box.x + box.width}`);
    assert.ok(box.y >= -1 && box.y + box.height <= 813, `dialog vertically at ${box.y}..${box.y + box.height}`);
    const targets = await dialogTargets(p);
    assert.ok(targets.some((t) => t.testid === 'delete-confirm'));
    for (const t of targets) assert.ok(t.width >= 43 && t.height >= 43, `${t.testid} is ${t.width}×${t.height}`);
    await p.context().close();
  });
});
