// US-50 (browser): review an imported game on /games/<G>: analyse in the browser, save, reload, re-analyse.
// G is the fake chess.com game 97500001 of the made-up `review_rook` (U played Black, P = 13 plies, ends in mate);
// the server runs with PUBLIC_ENGINE_DEPTH=6 (support/server.mjs).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Chess } from 'chess.js';
import { signedUpUser } from '../support/accounts.mjs';
import {
  accuracyNumbers, analysisError, bestMove, clickRetry, progressTexts, waitForAnalysisEnd, waitForAnalysisError,
  watchAnalysis,
} from '../support/analysis.mjs';
import { boardRanks, boardOrientation } from '../support/board.mjs';
import { clickCurvePly, layout, moveMarkWords, undersizedControls, waitForCurve } from '../support/curve.mjs';
import {
  clickReanalyse, cutAnalysisSaves, failAnalysisSaves, forgetProgressTexts, importReviewGames, openGamePage,
  reanalyseText, recordAnalysisRequests, reloadGamePage, signedInPage, storeZerosAnalysis, waitForAnsweredRequests,
  waitForOrientation,
} from '../support/game-page.mjs';
import { formatOneDecimal } from '../support/games.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, launchBrowser } from '../support/pages.mjs';
import {
  clickControl, currentMoveCount, currentPly, markWindow, pressKey, waitForSearch, windowMarker,
} from '../support/replay.mjs';

const near = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} is not ${expected} ±${tol}`);

let env, browser;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

/** A new signed-in user with the review_rook games imported → { user, g (U played Black), w (U played White) }. */
async function userWithGames(opts = {}) {
  const user = await signedUpUser(env.app.url, opts);
  const { black, white } = await importReviewGames(env.app.url, user);
  return { user, g: black, w: white };
}

function assertProgressTexts(texts, pattern, plies) {
  assert.ok(texts.length > 0, 'review-progress was never shown');
  for (const t of texts) {
    const m = pattern.exec(t);
    assert.ok(m, `progress text ${JSON.stringify(t)} does not match ${pattern}`);
    const n = Number(m[1]);
    assert.ok(n >= 1 && n <= plies, `N = ${n} is not in 1..${plies}`);
  }
}

/** Every move with data-ply = i + 1 shows marks[i] (null → no mark). */
async function assertMarksShown(page, marks) {
  const words = await moveMarkWords(page);
  marks.forEach((mark, i) => {
    assert.equal(words.get(i + 1), mark ?? '', `move data-ply=${i + 1}: shown ${JSON.stringify(words.get(i + 1))}, answer ${JSON.stringify(mark)}`);
  });
}

const posts = (calls) => calls.filter((c) => c.method === 'POST');

describe('given U opening /games/<G> with no analysis', () => {
  let page, calls, user, g, firstAnswer, shownBefore;
  before(async () => {
    ({ user, g } = await userWithGames());
    page = await signedInPage(browser, env.app.url, user);
    await watchAnalysis(page);
    calls = recordAnalysisRequests(page, g.id);
    await openGamePage(page, env.app.url, g.id);
  });
  after(() => page?.context().close());

  test('review-progress shows "Analysing move N/P", then exactly one POST with depth 6, P + 1 evals and P best answers 201', async () => {
    assert.equal(await waitForAnsweredRequests(calls, 1), true, 'no request answered on /api/games/<G>/analysis');
    assert.equal(await waitForAnalysisEnd(page), true, 'the analysis did not end');
    assertProgressTexts(await progressTexts(page), /^Analysing move (\d+)\/13$/, g.plies);
    const sent = posts(calls);
    assert.equal(sent.length, 1, `${sent.length} POSTs`);
    assert.equal(calls.length, 1, `${calls.length} requests to /api/games/<G>/analysis`);
    const [post] = sent;
    assert.equal(post.body?.depth, 6);
    assert.equal(post.body?.evals?.length, g.plies + 1);
    assert.equal(post.body?.best?.length, g.plies);
    assert.equal(post.status, 201);
    firstAnswer = post.answer;
  });

  test("given that POST's 201 answer, every move shows marks[i] and review-accuracy-white/-black show the accuracies with one decimal", async () => {
    assert.ok(firstAnswer?.marks, 'no 201 answer to compare with');
    await assertMarksShown(page, firstAnswer.marks);
    assert.deepEqual(await accuracyNumbers(page, 'white'), [formatOneDecimal(firstAnswer.accuracyWhite, 'en')]);
    assert.deepEqual(await accuracyNumbers(page, 'black'), [formatOneDecimal(firstAnswer.accuracyBlack, 'en')]);
    shownBefore = {
      marks: [...(await moveMarkWords(page)).entries()],
      white: await accuracyNumbers(page, 'white'),
      black: await accuracyNumbers(page, 'black'),
    };
  });

  test('given G analysed, when the page is reloaded, no review-progress appears, no request goes to the analysis endpoint, and the marks and accuracies are the same', async () => {
    assert.ok(shownBefore, 'no analysis shown before the reload');
    const before = calls.length;
    await reloadGamePage(page);
    assert.equal(await waitForAnalysisEnd(page), true, 'the stored analysis is not shown');
    assert.deepEqual(await progressTexts(page), []);
    assert.equal(calls.length, before, 'a request went to /api/games/<G>/analysis');
    assert.deepEqual([...(await moveMarkWords(page)).entries()], shownBefore.marks);
    assert.deepEqual(await accuracyNumbers(page, 'white'), shownBefore.white);
    assert.deepEqual(await accuracyNumbers(page, 'black'), shownBefore.black);
  });

  test('given G analysed, review-best shows a SAN move legal in the start position at ply 0, and nothing at ply P', async () => {
    await openGamePage(page, env.app.url, g.id, 0);
    assert.equal(await currentMoveCount(page), 0);
    const legal = new Chess().moves();
    const first = await bestMove(page);
    assert.ok(legal.includes(first), `best move ${JSON.stringify(first)} is not a legal first move`);
    await openGamePage(page, env.app.url, g.id, g.plies);
    assert.equal(await currentPly(page), g.plies);
    assert.equal(await bestMove(page), '');
  });

  test('review-reanalyse reads "Analyse again"', async () => {
    assert.equal(await reanalyseText(page), 'Analyse again');
  });

  test('given G analysed, clicking review-reanalyse shows review-progress, exactly one new POST answers 201, and the page shows its marks', async () => {
    const before = calls.length;
    await forgetProgressTexts(page);
    await clickReanalyse(page);
    assert.equal(await waitForAnsweredRequests(calls, before + 1), true, 'no new request answered');
    assert.equal(await waitForAnalysisEnd(page), true, 'the new analysis did not end');
    assertProgressTexts(await progressTexts(page), /^Analysing move (\d+)\/13$/, g.plies);
    const fresh = calls.slice(before);
    assert.equal(fresh.length, 1, `${fresh.length} new requests`);
    assert.equal(fresh[0].method, 'POST');
    assert.equal(fresh[0].status, 201);
    await assertMarksShown(page, fresh[0].answer.marks);
    assert.deepEqual(await accuracyNumbers(page, 'white'), [formatOneDecimal(fresh[0].answer.accuracyWhite, 'en')]);
  });
});

describe('given the analysis endpoint failing', () => {
  let user, g, w;
  before(async () => {
    ({ user, g, w } = await userWithGames());
  });

  test('when it answers 500, review-error shows "The analysis could not be saved."; once it works again, review-retry gets a 201 and the marks are shown', async () => {
    const page = await signedInPage(browser, env.app.url, user);
    try {
      const calls = recordAnalysisRequests(page, g.id);
      const restore = await failAnalysisSaves(page, g.id);
      await openGamePage(page, env.app.url, g.id);
      assert.equal(await waitForAnsweredRequests(calls, 1), true, 'no POST was sent');
      assert.equal(await waitForAnalysisError(page), true, 'review-error was not shown');
      assert.equal(calls[0].status, 500);
      const err = await analysisError(page);
      assert.equal(err.text, 'The analysis could not be saved.');
      assert.equal(err.retryShown, true, 'review-retry is not shown');

      await restore();
      const before = calls.length;
      await clickRetry(page);
      assert.equal(await waitForAnsweredRequests(calls, before + 1), true, 'no POST answered after review-retry');
      const ok = calls.slice(before).find((c) => c.method === 'POST' && c.status === 201);
      assert.ok(ok, `no POST answered 201 after review-retry: ${JSON.stringify(calls.map((c) => c.status))}`);
      assert.equal(await waitForAnalysisEnd(page), true, 'the analysis is not shown after review-retry');
      await assertMarksShown(page, ok.answer.marks);
      assert.equal((await analysisError(page)).shown, false, 'review-error is still shown');
    } finally {
      await page.context().close();
    }
  });

  test('when the POST fails on the network, review-error shows "The analysis could not be saved." with review-retry', async () => {
    const page = await signedInPage(browser, env.app.url, user);
    try {
      const calls = recordAnalysisRequests(page, w.id);
      await cutAnalysisSaves(page, w.id);
      await openGamePage(page, env.app.url, w.id);
      assert.equal(await waitForAnsweredRequests(calls, 1), true, 'no POST was sent');
      assert.equal(await waitForAnalysisError(page), true, 'review-error was not shown');
      const err = await analysisError(page);
      assert.equal(err.text, 'The analysis could not be saved.');
      assert.equal(err.retryShown, true, 'review-retry is not shown');
    } finally {
      await page.context().close();
    }
  });
});

describe('given G analysed (stored)', () => {
  let user, g, w;
  before(async () => {
    ({ user, g, w } = await userWithGames());
    await storeZerosAnalysis(env.app.url, user, g);
  });

  test('a game where U played Black opens with board data-orientation black; review-flip and F swap it', async () => {
    const page = await signedInPage(browser, env.app.url, user);
    try {
      await openGamePage(page, env.app.url, g.id);
      assert.equal(await boardOrientation(page), 'black');
      await clickControl(page, 'flip');
      assert.equal(await waitForOrientation(page, 'white'), true, 'review-flip did not turn the board to white');
      await pressKey(page, 'f');
      assert.equal(await waitForOrientation(page, 'black'), true, 'F did not turn the board back to black');
    } finally {
      await page.context().close();
    }
  });

  test('a game where U played White opens with board data-orientation white', async () => {
    const page = await signedInPage(browser, env.app.url, user);
    try {
      await openGamePage(page, env.app.url, w.id);
      assert.equal(await boardOrientation(page), 'white');
    } finally {
      await page.context().close();
    }
  });

  test('?ply=5 makes move 5 current; review-next, → and eval-curve-ply 9 go to ?ply=6, ?ply=7 and ?ply=9 with no reload', async () => {
    const page = await signedInPage(browser, env.app.url, user);
    try {
      await openGamePage(page, env.app.url, g.id, 5);
      assert.equal(await currentPly(page), 5);
      await waitForCurve(page);
      await markWindow(page);
      await clickControl(page, 'next');
      await waitForSearch(page, '?ply=6');
      assert.equal(await currentPly(page), 6);
      await pressKey(page, 'ArrowRight');
      await waitForSearch(page, '?ply=7');
      assert.equal(await currentPly(page), 7);
      await clickCurvePly(page, 9);
      await waitForSearch(page, '?ply=9');
      assert.equal(await currentPly(page), 9);
      assert.equal(await windowMarker(page), 'still-here', 'the page was reloaded');
    } finally {
      await page.context().close();
    }
  });

  test('?ply=99999 opens at ply P and ?ply=x at ply 0', async () => {
    const page = await signedInPage(browser, env.app.url, user);
    try {
      await openGamePage(page, env.app.url, g.id, 99999);
      assert.equal(await currentPly(page), g.plies);
      await openGamePage(page, env.app.url, g.id, 'x');
      assert.equal(await currentMoveCount(page), 0);
      assert.deepEqual(await boardRanks(page), ['rnbqkbnr', 'pppppppp', '8', '8', '8', '8', 'PPPPPPPP', 'RNBQKBNR']);
    } finally {
      await page.context().close();
    }
  });

  test('at 375×812: no sideways scroll, the eval bar is a strip above the board, every control is at least 44×44px', async () => {
    const page = await signedInPage(browser, env.app.url, user, { viewport: VIEWPORTS.mobile });
    try {
      await openGamePage(page, env.app.url, g.id);
      assert.equal(await waitForAnalysisEnd(page), true, 'the stored analysis is not shown');
      const l = await layout(page);
      assert.ok(l.bar && l.board && l.panel, 'eval-bar, board or panel missing');
      assert.ok(l.scrollWidth <= l.innerWidth, `scrollWidth ${l.scrollWidth} > ${l.innerWidth}`);
      assert.ok(l.bar.bottom <= l.board.y + 1, `eval-bar bottom ${l.bar.bottom} is below the board top ${l.board.y}`);
      assert.ok(l.bar.height < l.bar.width, `eval-bar is ${l.bar.width}×${l.bar.height}, not a horizontal strip`);
      assert.deepEqual(await undersizedControls(page), []);
    } finally {
      await page.context().close();
    }
  });

  test('at 1024×768: eval bar, board and panel are three columns with tops aligned within 2px', async () => {
    const page = await signedInPage(browser, env.app.url, user, { viewport: VIEWPORTS.desktop });
    try {
      await openGamePage(page, env.app.url, g.id);
      assert.equal(await waitForAnalysisEnd(page), true, 'the stored analysis is not shown');
      const l = await layout(page);
      assert.ok(l.bar && l.board && l.panel, 'eval-bar, board or panel missing');
      assert.ok(l.bar.right <= l.board.x + 1, 'eval-bar is not left of the board');
      assert.ok(l.board.right <= l.panel.x + 1, 'the board is not left of the panel');
      near(l.bar.y, l.board.y, 2, 'eval-bar top');
      near(l.panel.y, l.board.y, 2, 'panel top');
    } finally {
      await page.context().close();
    }
  });
});

describe('given U with language French', () => {
  let user, g, w;
  before(async () => {
    ({ user, g, w } = await userWithGames({ acceptLanguage: 'fr' }));
  });

  test('when the page analyses G, the progress reads "Analyse du coup N/P" and review-reanalyse reads "Analyser de nouveau"', async () => {
    const page = await signedInPage(browser, env.app.url, user, { lang: 'fr' });
    try {
      await watchAnalysis(page);
      await openGamePage(page, env.app.url, g.id);
      assert.equal(await waitForAnalysisEnd(page), true, 'the analysis did not end');
      assertProgressTexts(await progressTexts(page), /^Analyse du coup (\d+)\/13$/, g.plies);
      assert.equal(await reanalyseText(page), 'Analyser de nouveau');
    } finally {
      await page.context().close();
    }
  });

  test('when saving fails, review-error reads "L\'analyse n\'a pas pu être enregistrée."', async () => {
    const page = await signedInPage(browser, env.app.url, user, { lang: 'fr' });
    try {
      const calls = recordAnalysisRequests(page, w.id);
      await failAnalysisSaves(page, w.id);
      await openGamePage(page, env.app.url, w.id);
      assert.equal(await waitForAnsweredRequests(calls, 1), true, 'no POST was sent');
      assert.equal(await waitForAnalysisError(page), true, 'review-error was not shown');
      assert.equal((await analysisError(page)).text, "L'analyse n'a pas pu être enregistrée.");
    } finally {
      await page.context().close();
    }
  });
});
