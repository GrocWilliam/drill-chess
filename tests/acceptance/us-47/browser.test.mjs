// US-47 (browser): the replay of the demo game on /games/demo.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { boardFen, boardOrientation, typeMove } from '../support/board.mjs';
import { VIEWPORTS, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import {
  backToGameShown, clickBackToGame, clickControl, clickMove, controlBox, controlLabel, currentMoveCount, currentPly,
  focusMoveField, markWindow, moveListItems, moves, openReplay, pressKey, typeInMoveField, urlSearch, waitForSearch,
  windowMarker,
} from '../support/replay.mjs';
import { startServer } from '../support/server.mjs';

const PLY1 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const PLY4 = 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
const PLY5 = 'rnbqkbnr/ppp2ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3';

let app, browser;
before(async () => {
  app = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await app?.stop();
});

async function open({ ply, lang, viewport } = {}) {
  const page = await newVisitorPage(browser, { baseUrl: app.url, lang, viewport: viewport ?? VIEWPORTS.desktop });
  await openReplay(page, app.url, ply);
  return page;
}

describe('the move list', () => {
  test('has 33 moves in 17 items, with labels, and none is current', async () => {
    const page = await open();
    const ms = await moves(page);
    assert.equal(ms.length, 33);
    assert.deepEqual(ms.map((m) => m.ply), Array.from({ length: 33 }, (_, i) => i + 1));
    assert.equal(await moveListItems(page), 17);
    assert.equal(ms[0].text, 'e4');
    assert.equal(ms[0].label, '1. e4');
    assert.equal(ms[1].label, '1... e5');
    assert.equal(ms[32].label, '17. Rd8#');
    assert.equal(await currentMoveCount(page), 0);
    await page.context().close();
  });
});

describe('controls', () => {
  test('next goes to ply 1: URL, board and current move', async () => {
    const page = await open();
    await clickControl(page, 'next');
    await waitForSearch(page, '?ply=1');
    assert.equal(await boardFen(page), PLY1);
    assert.equal(await currentPly(page), 1);
    assert.equal((await moves(page))[0].currentValue, 'true');
    await page.context().close();
  });

  test('end, previous and start give ?ply=33, ?ply=32 and ?ply=0', async () => {
    const page = await open({ ply: 1 });
    await clickControl(page, 'end');
    await waitForSearch(page, '?ply=33');
    await clickControl(page, 'prev');
    await waitForSearch(page, '?ply=32');
    await clickControl(page, 'start');
    await waitForSearch(page, '?ply=0');
    assert.equal(await currentMoveCount(page), 0);
    await page.context().close();
  });
});

describe('keys', () => {
  test('→ ×3, ←, End, Home', async () => {
    const page = await open();
    for (let i = 0; i < 3; i++) await pressKey(page, 'ArrowRight');
    await waitForSearch(page, '?ply=3');
    await pressKey(page, 'ArrowLeft');
    await waitForSearch(page, '?ply=2');
    await pressKey(page, 'End');
    await waitForSearch(page, '?ply=33');
    await pressKey(page, 'Home');
    await waitForSearch(page, '?ply=0');
    await page.context().close();
  });

  test('F and review-flip toggle the orientation', async () => {
    const page = await open();
    assert.equal(await boardOrientation(page), 'white');
    await pressKey(page, 'f');
    await page.waitForFunction(() => document.querySelector('[data-testid="board"]').getAttribute('data-orientation') === 'black');
    await clickControl(page, 'flip');
    await page.waitForFunction(() => document.querySelector('[data-testid="board"]').getAttribute('data-orientation') === 'white');
    assert.equal(await urlSearch(page), '');
    await page.context().close();
  });

  test('keys are ignored while focus is in the move field', async () => {
    const page = await open({ ply: 2 });
    await focusMoveField(page);
    await typeInMoveField(page, 'F');
    await pressKey(page, 'ArrowRight');
    // Give a wrongly handled key time to act: the same round trip as a following control click.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await boardOrientation(page), 'white');
    assert.equal(await urlSearch(page), '?ply=2');
    assert.equal(await currentPly(page), 2);
    await page.context().close();
  });
});

describe('the ply in the URL', () => {
  test('clicking the move with data-ply 9', async () => {
    const page = await open();
    await clickMove(page, 9);
    await waitForSearch(page, '?ply=9');
    assert.equal(await currentPly(page), 9);
    await page.context().close();
  });

  test('/games/demo?ply=5 loaded and reloaded', async () => {
    const page = await open({ ply: 5 });
    assert.equal(await currentPly(page), 5);
    assert.equal(await boardFen(page), PLY5);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await currentPly(page), 5);
    assert.equal(await boardFen(page), PLY5);
    await page.context().close();
  });

  test('controls, keys and move clicks never reload the page', async () => {
    const page = await open();
    await markWindow(page);
    await clickControl(page, 'next');
    await waitForSearch(page, '?ply=1');
    await pressKey(page, 'ArrowRight');
    await waitForSearch(page, '?ply=2');
    await clickMove(page, 7);
    await waitForSearch(page, '?ply=7');
    await clickControl(page, 'end');
    await waitForSearch(page, '?ply=33');
    assert.equal(await windowMarker(page), 'still-here');
    await page.context().close();
  });
});

describe('free play', () => {
  test('a typed move leaves the line, more moves play, back to game returns to the ply', async () => {
    const page = await open({ ply: 4 });
    assert.equal(await boardFen(page), PLY4);
    await typeMove(page, 'Nc3');
    assert.notEqual(await boardFen(page), PLY4);
    assert.equal(await currentMoveCount(page), 0);
    assert.equal(await backToGameShown(page), true);
    const afterOne = await boardFen(page);
    await typeMove(page, 'Nf6');
    assert.notEqual(await boardFen(page), afterOne);
    assert.equal(await currentMoveCount(page), 0);
    assert.equal(await backToGameShown(page), true);
    await clickBackToGame(page);
    await waitForSearch(page, '?ply=4');
    assert.equal(await boardFen(page), PLY4);
    assert.equal(await currentPly(page), 4);
    assert.equal(await backToGameShown(page), false);
    await page.context().close();
  });

  test('a control returns to the game line', async () => {
    const page = await open({ ply: 4 });
    await typeMove(page, 'Nc3');
    assert.equal(await backToGameShown(page), true);
    await clickControl(page, 'next');
    await waitForSearch(page, '?ply=5');
    assert.equal(await boardFen(page), PLY5);
    assert.equal(await backToGameShown(page), false);
    await page.context().close();
  });
});

describe('French and sizes', () => {
  test('labels in French', async () => {
    const page = await open({ lang: 'fr' });
    assert.equal(await controlLabel(page, 'next'), 'Coup suivant');
    assert.equal(await controlLabel(page, 'flip'), "Retourner l'échiquier");
    await page.context().close();
  });

  for (const [name, vp] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
    test(`controls are at least 44×44 at ${name}`, async () => {
      const page = await open({ viewport: vp });
      for (const c of ['start', 'prev', 'next', 'end', 'flip']) {
        const box = await controlBox(page, c);
        assert.ok(box.width >= 43.5 && box.height >= 43.5, `${c}: ${box.width}×${box.height}`);
      }
      await page.context().close();
    });
  }
});
