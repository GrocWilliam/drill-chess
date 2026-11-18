// US-88 (browser): playing moves on the editor's board, errors, reload, path links, French and layout.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { addLine } from '../support/repertoire.mjs';
import { expectedOpening } from '../support/openings.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, undersizedTargets } from '../support/pages.mjs';
import {
  boardAndPanelBoxes, currentLine, currentPath, editorPage, errorText, followPathMove, openEditor, shownMoves, shownName,
  shownPath, shownPosition, typeMove, waitForLine,
} from '../support/repertoire-page.mjs';
import { fenAfter } from '../support/repertoire.mjs';

let app, url, browser;
before(async () => { app = await startServer(); url = app.url; browser = await launchBrowser(); });
after(async () => { await browser?.close(); await app?.stop(); });

const withPage = async (user, opts, fn) => {
  const page = await editorPage(browser, url, user, opts);
  try { await fn(page); } finally { await page.context().close(); }
};

describe('playing moves', () => {
  test('typing e4 in board-move-input: URL /openings/white?line=e2e4, path shows e4, name "B00 King\'s Pawn Game"', async () => {
    const u = await signedUpUser(url);
    await withPage(u, {}, async (page) => {
      await openEditor(page, url, 'white');
      await typeMove(page, 'e4');
      await waitForLine(page, 'e2e4');
      assert.equal(currentPath(page), '/openings/white');
      assert.deepEqual((await shownPath(page)).map((t) => t.replace(/^\d+\.+\s*/, '')), ['e4']);
      const o = expectedOpening(['e2e4']);
      assert.equal(await shownName(page), `${o.eco} ${o.name}`);
      assert.equal(await shownName(page), "B00 King's Pawn Game");
    });
  });

  test('then typing e5: URL ends ?line=e2e4,e7e5; back on ?line=e2e4, opening-moves lists e5 as Opponent', async () => {
    const u = await signedUpUser(url);
    await withPage(u, {}, async (page) => {
      await openEditor(page, url, 'white');
      await typeMove(page, 'e4');
      await waitForLine(page, 'e2e4');
      await typeMove(page, 'e5');
      await waitForLine(page, 'e2e4,e7e5');
      await openEditor(page, url, 'white', 'e2e4');
      const moves = await shownMoves(page);
      const e5 = moves.find((m) => m.uci === 'e7e5');
      assert.ok(e5, JSON.stringify(moves));
      assert.equal(e5.by, 'opponent');
      assert.ok(e5.text.includes('Opponent'), e5.text);
    });
  });

  test('with e5 stored, playing e5 again from ?line=e2e4 goes to ?line=e2e4,e7e5 and lists no duplicate', async () => {
    const u = await signedUpUser(url);
    await addLine(url, u.token, 'white', ['e2e4', 'e7e5']);
    await withPage(u, {}, async (page) => {
      await openEditor(page, url, 'white', 'e2e4');
      await typeMove(page, 'e5');
      await waitForLine(page, 'e2e4,e7e5');
      await openEditor(page, url, 'white', 'e2e4');
      const moves = await shownMoves(page);
      assert.equal(moves.filter((m) => m.uci === 'e7e5').length, 1, JSON.stringify(moves));
    });
  });

  test('with 1.e4 stored, playing d4 from the start shows "Delete e4 first to choose another move here" (role alert) and keeps the URL', async () => {
    const u = await signedUpUser(url);
    await addLine(url, u.token, 'white', ['e2e4']);
    await withPage(u, {}, async (page) => {
      await openEditor(page, url, 'white');
      const before = page.url();
      await typeMove(page, 'd4');
      const e = await errorText(page);
      assert.equal(e.text, 'Delete e4 first to choose another move here');
      assert.equal(e.role, 'alert');
      assert.equal(page.url(), before);
      assert.equal(currentLine(page), '');
    });
  });

  test('with the lang cookie fr, a rejected move shows "Supprimez e4 d\'abord pour choisir un autre coup ici"', async () => {
    const u = await signedUpUser(url);
    await addLine(url, u.token, 'white', ['e2e4']);
    await withPage(u, { lang: 'fr' }, async (page) => {
      await openEditor(page, url, 'white');
      assert.equal(await shownName(page), 'Position de départ');
      await typeMove(page, 'd4');
      assert.equal((await errorText(page)).text, "Supprimez e4 d'abord pour choisir un autre coup ici");
      assert.equal(currentLine(page), '');
    });
  });
});

describe('reload and path links', () => {
  test('line=e2e4,e7e5,g1f3 reloaded shows the same position and path', async () => {
    const u = await signedUpUser(url);
    await withPage(u, {}, async (page) => {
      await openEditor(page, url, 'white', 'e2e4,e7e5,g1f3');
      const pos = await shownPosition(page);
      const path = await shownPath(page);
      assert.equal(path.length, 3);
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByTestId('board').locator('piece').first().waitFor({ state: 'attached' });
      assert.equal(await shownPosition(page), pos);
      assert.deepEqual(await shownPath(page), path);
      assert.equal(pos.split(' ')[0], fenAfter('e2e4', 'e7e5', 'g1f3').split(' ')[0]);
    });
  });

  test('on ?line=e2e4,e7e5,g1f3, following the e5 link of opening-path goes to ?line=e2e4,e7e5', async () => {
    const u = await signedUpUser(url);
    await withPage(u, {}, async (page) => {
      await openEditor(page, url, 'white', 'e2e4,e7e5,g1f3');
      await followPathMove(page, 1);
      await waitForLine(page, 'e2e4,e7e5');
      assert.equal(await shownPosition(page), fenAfter('e2e4', 'e7e5').split(' ').slice(0, 4).join(' '));
    });
  });
});

describe('layout', () => {
  for (const [name, viewport] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
    test(`at ${name} on ?line=e2e4: no sideways scroll, every button and link at least 44×44`, async () => {
      const u = await signedUpUser(url);
      await addLine(url, u.token, 'white', ['e2e4', 'e7e5']);
      await withPage(u, { viewport }, async (page) => {
        await openEditor(page, url, 'white', 'e2e4');
        const s = await horizontalScroll(page);
        assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
        assert.deepEqual(await undersizedTargets(page), []);
      });
    });
  }

  test('at 1024×768 the board and the panel sit side by side with their tops aligned within 2px', async () => {
    const u = await signedUpUser(url);
    await withPage(u, { viewport: VIEWPORTS.desktop }, async (page) => {
      await openEditor(page, url, 'white', 'e2e4');
      const { board, panel } = await boardAndPanelBoxes(page);
      assert.ok(panel.x >= board.x + board.width - 1, JSON.stringify({ board, panel }));
      assert.ok(Math.abs(panel.y - board.y) <= 2, JSON.stringify({ board, panel }));
    });
  });
});
