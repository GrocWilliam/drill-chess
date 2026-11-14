// US-49 (browser): evaluation curve and layouts of the board page on /games/demo.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { waitForAnalysisEnd, watchAnalysis } from '../support/analysis.mjs';
import {
  clickCurvePly, curveFacts, evalTable, layout, markedMoveCount, moveMarkWords, openEvalTable,
  recordCodeRequests, undersizedControls, waitForCurve,
} from '../support/curve.mjs';
import { VIEWPORTS, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { currentPly, markWindow, openReplay, urlSearch, waitForSearch, windowMarker } from '../support/replay.mjs';
import { startServer } from '../support/server.mjs';

const PLIES = 33;
const near = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} is not ${expected} ±${tol}`);

let app, browser;
before(async () => {
  app = await startServer({ env: { PUBLIC_ENGINE_DEPTH: '6' } });
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await app?.stop();
});

async function openAnalysed({ lang, viewport = VIEWPORTS.desktop, record = false } = {}) {
  const page = await newVisitorPage(browser, { baseUrl: app.url, lang, viewport });
  await watchAnalysis(page);
  const code = record ? recordCodeRequests(page) : null;
  await openReplay(page, app.url);
  assert.equal(await waitForAnalysisEnd(page), true, 'the analysis did not end within 60 s');
  return { page, code };
}

describe('given the demo analysed', () => {
  let page, code;
  before(async () => {
    ({ page, code } = await openAnalysed({ record: true }));
    await waitForCurve(page);
  });
  after(() => page?.context().close());

  test('eval-curve is an inline SVG with 34 eval-curve-ply targets (data-ply 0 to 33), and no script or style came from another origin', async () => {
    const f = await curveFacts(page);
    assert.equal(f.isSvg, true, 'eval-curve is not an inline svg');
    assert.deepEqual([...f.targets].sort((a, b) => a - b), Array.from({ length: PLIES + 1 }, (_, i) => i));
    const origin = new URL(app.url).origin;
    const external = code.filter((u) => /^https?:/.test(u) && new URL(u).origin !== origin);
    assert.deepEqual(external, []);
    const embedded = await page.evaluate(() =>
      [...document.querySelectorAll('script[src], link[rel="stylesheet"]')].map((e) => e.src || e.href),
    );
    assert.deepEqual(embedded.filter((u) => new URL(u).origin !== origin), []);
  });

  test('clicking the eval-curve-ply of data-ply 12 sets ?ply=12 and marks move 12 current, with no reload', async () => {
    await markWindow(page);
    await clickCurvePly(page, 12);
    await waitForSearch(page, '?ply=12');
    assert.equal(await urlSearch(page), '?ply=12');
    assert.equal(await currentPly(page), 12);
    assert.equal(await page.getByTestId('move-list').locator('[data-testid="move"][data-ply="12"]').getAttribute('aria-current'), 'true');
    assert.equal(await windowMarker(page), 'still-here', 'the page was reloaded');
  });

  test('opening the "Evaluation table" gives 33 rows, row 33 reads Rd8# and 100.0, and each mark matches the move list', async () => {
    await openEvalTable(page);
    const t = await evalTable(page);
    assert.equal(t.rows.length, PLIES);
    assert.ok(t.rows[32].text.includes('Rd8#'), t.rows[32].text);
    assert.ok(t.rows[32].text.includes('100.0'), t.rows[32].text);
    const words = await moveMarkWords(page);
    const SYMBOL = { inaccuracy: '?!', mistake: '?', blunder: '??' };
    t.rows.forEach((row, i) => {
      const ply = i + 1;
      const word = words.get(ply);
      const cell = row.cells[row.cells.length - 1].toLowerCase();
      if (word) {
        assert.ok(cell.includes(word) || cell.includes(SYMBOL[word]), `ply ${ply}: mark cell ${JSON.stringify(cell)} is not ${word}`);
        if (word === 'inaccuracy') assert.ok(cell.includes('inaccuracy') || cell.includes('?!'));
        else assert.ok(!cell.includes('inaccuracy') && !cell.includes('?!'), `ply ${ply}: ${cell}`);
      } else {
        assert.ok(!/inaccuracy|mistake|blunder|\?/.test(cell), `ply ${ply} has no mark but its cell reads ${JSON.stringify(cell)}`);
      }
    });
  });

  test('the curve has as many mark dots as there are moves with a mark', async () => {
    const marked = await markedMoveCount(page);
    assert.ok(marked > 0, 'the demo game should have at least one marked move');
    assert.equal((await curveFacts(page)).dots, marked);
  });
});

describe('the mobile layout (375×812)', () => {
  let page;
  before(async () => {
    page = await newVisitorPage(browser, { baseUrl: app.url, viewport: VIEWPORTS.mobile });
    await openReplay(page, app.url);
  });
  after(() => page?.context().close());

  test('the eval bar is a strip above the board, the board is a 343px square, the panel is below, no sideways scroll', async () => {
    const l = await layout(page);
    assert.ok(l.bar && l.board && l.panel, 'eval-bar, board or panel missing');
    assert.ok(l.bar.bottom <= l.board.y + 1, `eval-bar bottom ${l.bar.bottom} is below the board top ${l.board.y}`);
    assert.ok(l.bar.height <= 16, `eval-bar is ${l.bar.height}px high`);
    near(l.bar.width, l.board.width, 2, 'eval-bar width vs board');
    near(l.board.width, l.board.height, 2, 'board squareness');
    near(l.board.width, 343, 2, 'board width');
    assert.ok(l.panel.y >= l.board.bottom - 1, `panel top ${l.panel.y} is above the board bottom ${l.board.bottom}`);
    assert.ok(l.scrollWidth <= l.innerWidth, `scrollWidth ${l.scrollWidth} > ${l.innerWidth}`);
  });
});

describe('the desktop layout (1024×768)', () => {
  let page;
  before(async () => {
    page = await newVisitorPage(browser, { baseUrl: app.url, viewport: VIEWPORTS.desktop });
    await openReplay(page, app.url);
  });
  after(() => page?.context().close());

  test('eval bar, board and panel sit side by side with tops aligned; 24px, 608px square and 380px wide; no sideways scroll', async () => {
    const l = await layout(page);
    assert.ok(l.bar && l.board && l.panel, 'eval-bar, board or panel missing');
    assert.ok(l.bar.right <= l.board.x + 1, 'eval-bar is not left of the board');
    assert.ok(l.board.right <= l.panel.x + 1, 'the board is not left of the panel');
    near(l.bar.y, l.board.y, 2, 'eval-bar top');
    near(l.panel.y, l.board.y, 2, 'panel top');
    near(l.bar.width, 24, 2, 'eval-bar width');
    assert.ok(l.bar.height >= l.board.height - 2, `eval-bar height ${l.bar.height} < board ${l.board.height}`);
    near(l.board.width, l.board.height, 2, 'board squareness');
    near(l.board.width, 608, 2, 'board width');
    near(l.panel.width, 380, 2, 'panel width');
    assert.ok(l.scrollWidth <= l.innerWidth, `scrollWidth ${l.scrollWidth} > ${l.innerWidth}`);
  });
});

describe('touch targets', () => {
  for (const [name, viewport] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
    test(`at ${name}, every button and link of the board page is at least 44×44px`, async () => {
      const { page } = await openAnalysed({ viewport });
      assert.deepEqual(await undersizedControls(page), []);
      await page.context().close();
    });
  }
});

describe('in French', () => {
  test('the details read "Tableau des évaluations" with columns "Coup", "Chances des Blancs" and "Annotation"', async () => {
    const { page } = await openAnalysed({ lang: 'fr' });
    await waitForCurve(page);
    await openEvalTable(page);
    const t = await evalTable(page);
    assert.equal(t.summary, 'Tableau des évaluations');
    assert.deepEqual(t.headers.slice(0, 3), ['Coup', 'Chances des Blancs', 'Annotation']);
    await page.context().close();
  });
});
