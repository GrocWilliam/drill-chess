// US-48 (browser): Stockfish analyses the demo game in the browser (server started with PUBLIC_ENGINE_DEPTH=6).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  accuracyNumbers, accuracyText, analysisError, bestMove, breakEngineFile, clickRetry, evalBar, markedMoves,
  progressShown, progressTexts, releaseEngine, waitForAnalysisEnd, waitForAnalysisError, waitForProgress,
  watchAnalysis,
} from '../support/analysis.mjs';
import { VIEWPORTS, launchBrowser, newVisitorPage, recordRequests } from '../support/pages.mjs';
import { clickControl, clickMove, openReplay, waitForSearch } from '../support/replay.mjs';
import { startServer } from '../support/server.mjs';

const PLIES = 33;
const FIRST_MOVES = [
  'a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4', 'e3', 'e4', 'f3', 'f4', 'g3', 'g4', 'h3', 'h4',
  'Na3', 'Nc3', 'Nf3', 'Nh3',
];
const MARKS = { '': '', ', inaccuracy': '?!', ', mistake': '?', ', blunder': '??' };

let app, browser;
before(async () => {
  app = await startServer({ env: { PUBLIC_ENGINE_DEPTH: '6' } });
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await app?.stop();
});

/** A new visitor page on /games/demo, watched from before the first script runs. */
async function openDemo({ lang, hold = false, beforeOpen } = {}) {
  const page = await newVisitorPage(browser, { baseUrl: app.url, lang, viewport: VIEWPORTS.desktop });
  await watchAnalysis(page, { holdWhileAnalysing: hold });
  const extra = beforeOpen ? await beforeOpen(page) : undefined;
  await openReplay(page, app.url);
  return { page, extra };
}

function assertProgress(texts, pattern) {
  assert.ok(texts.length > 0, 'review-progress was never shown');
  for (const t of texts) {
    const m = pattern.exec(t);
    assert.ok(m, `progress text ${JSON.stringify(t)} does not match ${pattern}`);
    const n = Number(m[1]);
    assert.ok(n >= 1 && n <= PLIES, `N = ${n} is not in 1..${PLIES}`);
  }
}

/** The single number of `review-accuracy-<side>` (asserting there is exactly one). */
async function accuracy(page, side) {
  const nums = await accuracyNumbers(page, side);
  assert.equal(nums.length, 1, `review-accuracy-${side} should hold one number, holds ${JSON.stringify(nums)}`);
  return nums[0];
}

function assertAccuracy(written, sep) {
  const re = sep === '.' ? /^\d{1,3}\.\d$/ : /^\d{1,3},\d$/;
  assert.match(written, re);
  const v = Number(written.replace(',', '.'));
  assert.ok(v >= 0 && v <= 100, `${written} is not in 0..100`);
}

describe('the analysis progress', () => {
  test('when /games/demo loads, review-progress shows "Analysing move N/33" (1 ≤ N ≤ 33), then disappears within 60 s', async () => {
    const { page } = await openDemo();
    assert.equal(await waitForAnalysisEnd(page), true, 'the analysis did not end within 60 s');
    assertProgress(await progressTexts(page), /^Analysing move (\d+)\/33$/);
    assert.equal(await progressShown(page), false);
    await page.context().close();
  });

  test('while review-progress is shown, clicking review-next sets ?ply=1 (the board stays usable)', async () => {
    const { page } = await openDemo({ hold: true });
    await waitForProgress(page);
    await clickControl(page, 'next');
    await waitForSearch(page, '?ply=1');
    assert.equal(await progressShown(page), true, 'the analysis should still be running');
    await releaseEngine(page);
    assert.equal(await waitForAnalysisEnd(page), true);
    await page.context().close();
  });
});

describe('no request leaves the page', () => {
  test('given the demo analysed, no request goes to /api/games/ and none leaves the app origin', async () => {
    let urls;
    const { page } = await openDemo({ beforeOpen: async (p) => (urls = recordRequests(p)) });
    assert.equal(await waitForAnalysisEnd(page), true);
    const origin = new URL(app.url).origin;
    const http = urls.filter((u) => /^https?:/.test(u));
    assert.ok(http.length > 0, 'no request recorded');
    assert.deepEqual(http.filter((u) => new URL(u).pathname.startsWith('/api/games/')), []);
    assert.deepEqual(http.filter((u) => new URL(u).origin !== origin), []);
    await page.context().close();
  });
});

describe('given the demo analysed', () => {
  let page;
  before(async () => {
    ({ page } = await openDemo());
    assert.equal(await waitForAnalysisEnd(page), true, 'the analysis did not end within 60 s');
  });
  after(() => page?.context().close());

  test('review-best reads Rd8# at ?ply=32, holds no move at ?ply=33, and one of the 20 legal first moves at ?ply=0', async () => {
    await clickMove(page, 32);
    await waitForSearch(page, '?ply=32');
    assert.equal(await bestMove(page), 'Rd8#');
    await clickMove(page, 33);
    await waitForSearch(page, '?ply=33');
    assert.equal(await bestMove(page), '');
    await clickControl(page, 'start');
    await waitForSearch(page, '?ply=0');
    const first = await bestMove(page);
    assert.ok(FIRST_MOVES.includes(first), `best move ${JSON.stringify(first)} is not a legal first move`);
  });

  test('eval-bar at ?ply=33 is 100 with text 1-0; at ?ply=0 it is between 0 and 100 with a score text', async () => {
    await clickMove(page, 33);
    await waitForSearch(page, '?ply=33');
    const end = await evalBar(page);
    assert.equal(end.role, 'meter');
    assert.equal(end.valueNow, 100);
    assert.equal(end.text, '1-0');
    await clickControl(page, 'start');
    await waitForSearch(page, '?ply=0');
    const start = await evalBar(page);
    assert.ok(start.valueNow >= 0 && start.valueNow <= 100, `aria-valuenow ${start.valueNow}`);
    assert.match(start.text, /^([+−]\d+\.\d|0\.0|−?M\d+)$/);
  });

  test('the move with data-ply="33" is labelled "17. Rd8#" with no mark', async () => {
    const last = (await markedMoves(page)).find((m) => m.ply === 33);
    assert.equal(last.label, '17. Rd8#');
    assert.equal(last.text, 'Rd8#');
  });

  test('every move label ends with nothing, ", inaccuracy", ", mistake" or ", blunder", and marked moves show the matching symbol', async () => {
    const ms = await markedMoves(page);
    assert.equal(ms.length, PLIES);
    for (const m of ms) {
      const suffix = Object.keys(MARKS).filter((s) => s).find((s) => m.label.endsWith(s)) ?? '';
      const head = m.label.slice(0, m.label.length - suffix.length);
      assert.match(head, /^\d+\.(\.\.)? \S+$/, `label ${m.label}`);
      const san = head.replace(/^\d+\.(\.\.)? /, '');
      assert.equal(m.text, san + MARKS[suffix], `move ${m.ply} (${m.label}) shows ${m.text}`);
    }
  });

  test('review-accuracy-white and review-accuracy-black are numbers from 0 to 100 with one decimal', async () => {
    assertAccuracy(await accuracy(page, 'white'), '.');
    assertAccuracy(await accuracy(page, 'black'), '.');
  });
});

describe('the analysis is the same on every run', () => {
  test('after a reload, every move label and both accuracies are identical to the first run', async () => {
    const { page } = await openDemo();
    const run = async () => {
      assert.equal(await waitForAnalysisEnd(page), true, 'the analysis did not end within 60 s');
      return {
        labels: (await markedMoves(page)).map((m) => m.label),
        white: await accuracy(page, 'white'),
        black: await accuracy(page, 'black'),
      };
    };
    const first = await run();
    await page.reload({ waitUntil: 'networkidle' });
    const second = await run();
    assert.deepEqual(second, first);
    await page.context().close();
  });
});

describe('in French', () => {
  test('the progress reads "Analyse du coup N/33", review-accuracy holds "Précision" and accuracies use a decimal comma', async () => {
    const { page } = await openDemo({ lang: 'fr' });
    assert.equal(await waitForAnalysisEnd(page), true, 'the analysis did not end within 60 s');
    assertProgress(await progressTexts(page), /^Analyse du coup (\d+)\/33$/);
    const text = await accuracyText(page);
    assert.ok(text.includes('Précision'), text);
    assertAccuracy(await accuracy(page, 'white'), ',');
    assertAccuracy(await accuracy(page, 'black'), ',');
    await page.context().close();
  });
});

describe('when the engine fails to start', () => {
  test('with /stockfish/stockfish.js answering 404, review-error shows "The analysis failed." with review-retry', async () => {
    const { page } = await openDemo({ beforeOpen: (p) => breakEngineFile(p) });
    assert.equal(await waitForAnalysisError(page), true, 'review-error was not shown');
    const err = await analysisError(page);
    assert.equal(err.role, 'alert');
    assert.ok(err.text.includes('The analysis failed.'), err.text);
    assert.equal(err.retryShown, true);
    assert.equal(err.retryText, 'Retry');
    await page.context().close();
  });

  test('review-retry runs the analysis again once the engine file loads', async () => {
    const { page, extra: restore } = await openDemo({ beforeOpen: (p) => breakEngineFile(p) });
    assert.equal(await waitForAnalysisError(page), true, 'review-error was not shown');
    await restore();
    await clickRetry(page);
    assert.equal(await waitForAnalysisEnd(page), true, 'the analysis did not end after retry');
    assert.equal((await analysisError(page)).shown, false);
    await page.context().close();
  });
});
