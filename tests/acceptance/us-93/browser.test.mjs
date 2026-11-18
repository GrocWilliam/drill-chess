// US-93 (browser): playing a drill line on the board at /openings/drill: automatic moves, right and wrong moves,
// the reviews the page sends, the next line, French feedback and the layout at 375 and 1024px.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { utcDay } from '../support/cards.mjs';
import { expectedOpening } from '../support/openings.mjs';
import { fenAfter } from '../support/repertoire.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, undersizedTargets } from '../support/pages.mjs';
import {
  arrows, boardAndPanelBoxes, boardOrientation, currentDrillMoves, drillPage, drillRequests, feedbackHistory,
  feedbackText, openDrill, positionStays, progressText, repertoireLine, reviewMovesCorrect, sentReviews, shownFen,
  shownOpeningName, shownPosition, typeMove, waitForArrow, waitForFeedback, waitForPosition,
  waitForProgress, waitForReviews,
} from '../support/drill-page.mjs';
import { summaryOf, waitForSummary } from '../support/drill-summary.mjs';

const NAJDORF_START = ['e2e4', 'c7c5', 'g1f3', 'd7d6'];
const pos = (...ucis) => fenAfter(...ucis).split(' ').slice(0, 4).join(' ');

let app, url, browser;
before(async () => { app = await startServer(); url = app.url; browser = await launchBrowser(); }, { timeout: 300000 });
after(async () => { await browser?.close(); await app?.stop(); });

/** A user with the black repertoire 1.e4 c5 2.Nf3 d6, both cards due → { user, moves } (moves with their card ids). */
async function blackSicilian() {
  const user = await signedUpUser(url);
  const moves = await repertoireLine(url, user.token, 'black', NAJDORF_START);
  return { user, moves, card: (uci) => moves.find((m) => m.uci === uci).cardId };
}
const withPage = async (user, opts, fn) => {
  const page = await drillPage(browser, url, user, opts);
  try { await fn(page); } finally { await page.context().close(); }
};
/** Opens the black drill with seed 1 and waits until the board shows the position after 1.e4. */
async function openAtC5(page) {
  await openDrill(page, url, 'colour=black&seed=1');
  assert.ok(await waitForPosition(page, fenAfter('e2e4')), `board at ${await shownPosition(page)}`);
}

describe('a black repertoire 1.e4 c5 2.Nf3 d6, both cards due, ?colour=black&seed=1', () => {
  test('the board is oriented black, 1.e4 is played automatically, and the board waits', async () => {
    const { user } = await blackSicilian();
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      assert.equal(await boardOrientation(page), 'black');
      assert.ok(await positionStays(page), 'the board waits at the position after 1.e4');
      assert.equal(await shownPosition(page), pos('e2e4'));
    });
  });

  test('drill-progress reads "0/20" and shows the opening name', async () => {
    const { user } = await blackSicilian();
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      assert.match(await progressText(page), /(^|[^0-9])0\/20(?![0-9])/);
      const o = expectedOpening(NAJDORF_START);
      assert.ok(o, 'the dataset names 1.e4 c5 2.Nf3 d6');
      assert.equal(await shownOpeningName(page), `${o.eco} ${o.name}`);
    });
  });
});

describe('waiting for c5, the player types c5', () => {
  test('drill-feedback reads "Correct"', async () => {
    const { user } = await blackSicilian();
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      await typeMove(page, 'c5');
      assert.ok(await waitForFeedback(page, 'Correct'), `feedback shown: ${JSON.stringify(await feedbackHistory(page))}`);
    });
  });

  test('Nf3 is played automatically and the board waits for d6', async () => {
    const { user } = await blackSicilian();
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      await typeMove(page, 'c5');
      assert.ok(await waitForPosition(page, fenAfter('e2e4', 'c7c5', 'g1f3')), `board at ${await shownPosition(page)}`);
      assert.ok(await positionStays(page), 'the board waits for d6');
      assert.equal(await shownPosition(page), pos('e2e4', 'c7c5', 'g1f3'));
    });
  });

  test('drill-progress reads "1/20"', async () => {
    const { user } = await blackSicilian();
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      await typeMove(page, 'c5');
      assert.ok(await waitForProgress(page, 1), `drill-progress: ${await progressText(page)}`);
      assert.match(await progressText(page), /(^|[^0-9])1\/20(?![0-9])/);
    });
  });

  test('the c5 card review {"correct": true} returned reps 1 and dueOn tomorrow; the drill API no longer has c5 due', async () => {
    const { user, card } = await blackSicilian();
    const before = utcDay(1);
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      await typeMove(page, 'c5');
      assert.ok(await waitForReviews(page, 1), 'a review was sent');
      await waitForPosition(page, fenAfter('e2e4', 'c7c5', 'g1f3'));
      const reviews = (await sentReviews(page)).filter((r) => r.cardId === card('c7c5'));
      assert.equal(reviews.length, 1, JSON.stringify(await sentReviews(page)));
      assert.deepEqual(reviews[0].body, { correct: true });
      assert.equal(reviews[0].status, 200);
      assert.equal(reviews[0].card.reps, 1);
      assert.ok([before, utcDay(1)].includes(reviews[0].card.dueOn), `dueOn ${reviews[0].card.dueOn}`);
    });
    const c5 = (await currentDrillMoves(url, user.token, 'black')).find((m) => m.uci === 'c7c5');
    assert.ok(c5, 'the line still holds c5');
    assert.equal(c5.due, false);
  });

  test('then d6 ends the line: the page fetches the next line with seed + 1 and, none being left, ends with drill-summary (US-94)', async () => {
    const { user } = await blackSicilian();
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      await typeMove(page, 'c5');
      assert.ok(await waitForPosition(page, fenAfter('e2e4', 'c7c5', 'g1f3')));
      await typeMove(page, 'd6');
      assert.ok(await waitForSummary(page), 'drill-summary is shown');
      const sum = await summaryOf(page);
      assert.equal(sum.right, 2);
      assert.equal(sum.wrong, 0);
      const asked = drillRequests(page);
      assert.ok(asked.some((q) => q.colour === 'black' && q.seed === '2'), JSON.stringify(asked));
    });
  });
});

describe('waiting for c5, the player types e5', () => {
  test('the board goes back (data-fen unchanged), drill-feedback reads "The move was c5", an arrow c7→c5 is drawn, and the board still waits', async () => {
    const { user } = await blackSicilian();
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      const fen = await shownFen(page);
      await typeMove(page, 'e5');
      assert.ok(await waitForFeedback(page, 'The move was c5'), `feedback shown: ${JSON.stringify(await feedbackHistory(page))}`);
      assert.ok(await waitForArrow(page, 'c7', 'c5'), `arrows: ${JSON.stringify(await arrows(page))}`);
      assert.equal(await shownFen(page), fen);
      assert.ok(await positionStays(page), 'the board still waits');
      assert.equal(await shownFen(page), fen);
      assert.equal(await feedbackText(page), 'The move was c5');
    });
  });

  test('typing e5 again changes nothing more and sends no second review', async () => {
    const { user } = await blackSicilian();
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      const fen = await shownFen(page);
      await typeMove(page, 'e5');
      assert.ok(await waitForFeedback(page, 'The move was c5'));
      assert.ok(await waitForReviews(page, 1), 'a review was sent');
      await typeMove(page, 'e5');
      assert.equal(await waitForReviews(page, 2, 1500), false, JSON.stringify(await sentReviews(page)));
      assert.equal(await shownFen(page), fen);
      assert.equal(await feedbackText(page), 'The move was c5');
    });
  });

  test('typing c5 then lets the line go on; the card was reviewed once, correct: false (reps 0, interval 1)', async () => {
    const { user, card } = await blackSicilian();
    await withPage(user, {}, async (page) => {
      await openAtC5(page);
      await typeMove(page, 'e5');
      assert.ok(await waitForFeedback(page, 'The move was c5'));
      await typeMove(page, 'c5');
      assert.ok(await waitForPosition(page, fenAfter('e2e4', 'c7c5', 'g1f3')), `board at ${await shownPosition(page)}`);
      assert.ok(await positionStays(page), 'the board waits for d6');
      const reviews = (await sentReviews(page)).filter((r) => r.cardId === card('c7c5'));
      assert.equal(reviews.length, 1, JSON.stringify(await sentReviews(page)));
      assert.deepEqual(reviews[0].body, { correct: false });
      assert.equal(reviews[0].status, 200);
      assert.equal(reviews[0].card.reps, 0);
      assert.equal(reviews[0].card.intervalDays, 1);
    });
  });

  test('with the lang cookie fr, drill-feedback reads "Le coup était c5"', async () => {
    const { user } = await blackSicilian();
    await withPage(user, { lang: 'fr' }, async (page) => {
      await openAtC5(page);
      await typeMove(page, 'e5');
      assert.ok(await waitForFeedback(page, 'Le coup était c5'), `feedback shown: ${JSON.stringify(await feedbackHistory(page))}`);
      assert.equal(await feedbackText(page), 'Le coup était c5');
    });
  });
});

describe('a white repertoire 1.e4 e5 2.Nf3, e4 reviewed (not due), Nf3 due', () => {
  test('e4 and e5 are played automatically and the board first waits after 1.e4 e5', async () => {
    const user = await signedUpUser(url);
    const moves = await repertoireLine(url, user.token, 'white', ['e2e4', 'e7e5', 'g1f3']);
    await reviewMovesCorrect(url, user.token, moves.filter((m) => m.uci === 'e2e4'));
    await withPage(user, {}, async (page) => {
      await openDrill(page, url, 'colour=white');
      assert.equal(await boardOrientation(page), 'white');
      assert.ok(await waitForPosition(page, fenAfter('e2e4', 'e7e5')), `board at ${await shownPosition(page)}`);
      assert.ok(await positionStays(page), 'the board waits for Nf3');
      assert.equal(await shownPosition(page), pos('e2e4', 'e7e5'));
    });
  });
});

describe('layout while the drill waits for a move', () => {
  for (const [name, viewport] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
    test(`at ${name}: no sideways scroll, every button and link at least 44×44`, async () => {
      const { user } = await blackSicilian();
      await withPage(user, { viewport }, async (page) => {
        await openAtC5(page);
        const s = await horizontalScroll(page);
        assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
        assert.deepEqual(await undersizedTargets(page), []);
      });
    });
  }

  test('at 1024×768 the board and the panel sit side by side', async () => {
    const { user } = await blackSicilian();
    await withPage(user, { viewport: VIEWPORTS.desktop }, async (page) => {
      await openAtC5(page);
      const { board, panel } = await boardAndPanelBoxes(page);
      assert.ok(panel.x >= board.x + board.width - 1, JSON.stringify({ board, panel }));
      assert.ok(panel.y < board.y + board.height && board.y < panel.y + panel.height, JSON.stringify({ board, panel }));
    });
  });
});
