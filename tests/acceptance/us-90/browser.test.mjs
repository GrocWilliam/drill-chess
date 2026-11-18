// US-90 (browser): the delete modal with and without JavaScript, cancel, French and layout at 375px.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { addLineIds } from '../support/repertoire.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import {
  cancelDelete, confirmDelete, currentLine, currentPath, currentSearch, deleteModal, editorPage, modalTargets, modalText,
  openEditor, pressDelete, shownMoves,
} from '../support/repertoire-page.mjs';

let app, url, browser;
before(async () => { app = await startServer(); url = app.url; browser = await launchBrowser(); });
after(async () => { await browser?.close(); await app?.stop(); });

async function setup() {
  const u = await signedUpUser(url);
  await addLineIds(url, u.token, 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4']);
  await addLineIds(url, u.token, 'white', ['e2e4', 'c7c5']);
  return u;
}
const withPage = async (user, opts, fn) => {
  const page = await editorPage(browser, url, user, opts);
  try { await fn(page); } finally { await page.context().close(); }
};
const ucis = async (page) => (await shownMoves(page)).map((m) => m.uci).sort();

describe('deleting in the browser', () => {
  test('without JavaScript: opening-delete then opening-delete-confirm: back on /openings/white?line=e2e4, no dialog, e5 gone', async () => {
    const u = await setup();
    const page = await newVisitorPage(browser, { baseUrl: url, session: u.token, javaScriptEnabled: false });
    try {
      await page.goto(`${url}/openings/white?line=e2e4`);
      await pressDelete(page, 'e7e5');
      await deleteModal(page).waitFor({ state: 'visible' });
      await confirmDelete(page);
      await page.waitForURL((x) => !x.searchParams.has('modal') && x.searchParams.get('line') === 'e2e4');
      assert.equal(currentPath(page), '/openings/white');
      assert.equal(currentSearch(page).get('line'), 'e2e4');
      assert.equal(await deleteModal(page).count(), 0);
      assert.deepEqual(await ucis(page), ['c7c5']);
    } finally { await page.context().close(); }
  });

  test('with JavaScript: e5 disappears from opening-moves and the URL is ?line=e2e4 with no modal', async () => {
    const u = await setup();
    await withPage(u, {}, async (page) => {
      await openEditor(page, url, 'white', 'e2e4');
      await pressDelete(page, 'e7e5');
      await deleteModal(page).waitFor({ state: 'visible' });
      await confirmDelete(page);
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('modal'));
      await deleteModal(page).waitFor({ state: 'detached' });
      assert.equal(currentLine(page), 'e2e4');
      assert.deepEqual(await ucis(page), ['c7c5']);
    });
  });

  test('cancel: the modal closes, back to the line, nothing is deleted', async () => {
    const u = await setup();
    await withPage(u, {}, async (page) => {
      await openEditor(page, url, 'white', 'e2e4');
      await pressDelete(page, 'e7e5');
      await deleteModal(page).waitFor({ state: 'visible' });
      await cancelDelete(page);
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('modal'));
      assert.equal(currentLine(page), 'e2e4');
      assert.deepEqual(await ucis(page), ['c7c5', 'e7e5']);
      await page.reload({ waitUntil: 'networkidle' });
      assert.deepEqual(await ucis(page), ['c7c5', 'e7e5']);
    });
  });

  test('lang fr: the opened modal is in French', async () => {
    const u = await setup();
    await withPage(u, { lang: 'fr' }, async (page) => {
      await openEditor(page, url, 'white', 'e2e4');
      await pressDelete(page, 'e7e5');
      await deleteModal(page).waitFor({ state: 'visible' });
      const t = await modalText(page);
      assert.ok(/supprim/i.test(t), t);
      assert.ok(!/Delete/.test(t), t);
    });
  });

  test('375×812: no sideways scroll and the modal buttons are at least 44×44px', async () => {
    const u = await setup();
    await withPage(u, { viewport: VIEWPORTS.mobile }, async (page) => {
      await openEditor(page, url, 'white', 'e2e4');
      await pressDelete(page, 'e7e5');
      await deleteModal(page).waitFor({ state: 'visible' });
      const h = await horizontalScroll(page);
      assert.ok(h.scrollWidth <= h.innerWidth + 1, `scrollWidth ${h.scrollWidth} > ${h.innerWidth}`);
      const targets = (await modalTargets(page)).filter((t) => ['opening-delete-confirm', 'opening-delete-cancel'].includes(t.testid));
      assert.equal(targets.length, 2);
      for (const t of targets) assert.ok(t.width >= 43 && t.height >= 43, `${t.testid} ${t.width}x${t.height}`);
    });
  });
});
