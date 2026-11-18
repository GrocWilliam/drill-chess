// US-111 (browser): the endgame board page.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, undersizedTargets } from '../support/pages.mjs';
import * as eg from '../support/endgame-play-page.mjs';
import { lessonText as lesson } from '../support/endgame-play-page.mjs';

let app, url, browser;
before(async () => { app = await startServer(); url = app.url; browser = await launchBrowser(); });
after(async () => { await browser?.close(); await app?.stop(); });

const KQK = '8/8/8/4k3/8/8/8/3QK3 w - - 0 1';

async function withPage(opts, id, fn) {
  const user = await signedUpUser(url);
  const page = await eg.endgamePlayPage(browser, url, user, opts);
  try {
    await eg.openEndgame(page, url, id);
    await fn(page);
  } finally {
    await page.context().close();
  }
}

test('philidor: orientation is black and the goal is "Hold the draw"', () =>
  withPage({}, 'philidor', async (page) => {
    assert.equal(await eg.boardOrientation(page), 'black');
    assert.equal(await eg.goalShown(page), 'Hold the draw');
  }));

for (const [how, play] of [['the board', (p) => eg.dragPiece(p, 'd1', 'd4')], ['the typed-move field', (p) => eg.typeMove(p, 'Qd4')]]) {
  test(`playing Qd4 by ${how} shows it in the moves list and the queen on d4`, () =>
    withPage({}, 'kq-k', async (page) => {
      await play(page);
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="endgame-move"]').length > 0);
      assert.deepEqual(await eg.movesShown(page), ['Qd4']);
      assert.equal(await eg.pieceOn(page, 'd4'), 'Q');
    }));
}

test('Retry restores the position, clears the moves and posts nothing', () =>
  withPage({}, 'kq-k', async (page) => {
    const posts = eg.attemptsRequests(page);
    await eg.typeMove(page, 'Qd4');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="endgame-move"]').length > 0);
    await eg.pressRetry(page);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="endgame-move"]').length === 0);
    assert.equal(await eg.boardFen(page), KQK);
    assert.deepEqual(await eg.movesShown(page), []);
    assert.deepEqual(posts, []);
  }));

test('moving a piece of the other side leaves the board unchanged', () =>
  withPage({}, 'kq-k', async (page) => {
    await eg.dragPiece(page, 'e5', 'e6');
    assert.equal(await eg.boardFen(page), KQK);
    assert.deepEqual(await eg.movesShown(page), []);
    assert.equal(await eg.pieceOn(page, 'e5'), 'k');
  }));

test('the back link leads to /endgames', () =>
  withPage({}, 'kq-k', async (page) => {
    await eg.clickBack(page);
    await page.waitForURL((u) => u.pathname === '/endgames');
  }));

test('a French user sees lucena in French', () =>
  withPage({ lang: 'fr' }, 'lucena', async (page) => {
    assert.equal(await eg.nameShown(page), 'Position de Lucena');
    assert.equal(await eg.goalShown(page), 'Gagner');
    assert.equal(await eg.statusShown(page), 'À vous de jouer');
    assert.equal(await eg.retryLabel(page), 'Recommencer');
    assert.equal(await eg.lessonShown(page), lesson('fr', 'lucena'));
  }));

test('vancura at 375×812: no sideways scroll, board inside the viewport, targets ≥ 44px', () =>
  withPage({ viewport: VIEWPORTS.mobile }, 'vancura', async (page) => {
    const s = await horizontalScroll(page);
    assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
    const { board } = await eg.boxes(page);
    assert.ok(board.x >= -1 && board.x + board.width <= s.innerWidth + 1, JSON.stringify(board));
    assert.deepEqual(await undersizedTargets(page), []);
  }));

test('vancura at 1024×768: no sideways scroll, board and panel side by side and aligned, targets ≥ 44px', () =>
  withPage({ viewport: VIEWPORTS.desktop }, 'vancura', async (page) => {
    const s = await horizontalScroll(page);
    assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
    const { board, name } = await eg.boxes(page);
    assert.ok(name.x >= board.x + board.width - 1, `panel right of board: ${JSON.stringify({ board, name })}`);
    assert.ok(Math.abs(name.y - board.y) <= 4 + 24, `tops: ${JSON.stringify({ board, name })}`);
    assert.deepEqual(await undersizedTargets(page), []);
  }));
