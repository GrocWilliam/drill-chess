// US-94 (browser): the drill ends with drill-summary after 20 cards or when nothing is due; colour=both.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { utcDay } from '../support/cards.mjs';
import { addLine } from '../support/repertoire.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, undersizedTargets } from '../support/pages.mjs';
import { homeHtml, cardOf, fieldOf } from '../support/openings-home.mjs';
import {
  currentDrillMoves, drillPage, formatDay, openDrill, repertoireLine, shownPosition, typeMove, waitForFeedback,
  waitForPosition,
} from '../support/drill-page.mjs';
import { movesOf, requestDrill } from '../support/drill.mjs';
import { fenAfter } from '../support/repertoire.mjs';
import {
  boardShown, followAgain, noneText, playToSummary, progressEverReached, recordProgress, summaryOf, waitForSummary,
} from '../support/drill-summary.mjs';

let app, url, browser;
before(async () => { app = await startServer(); url = app.url; browser = await launchBrowser(); }, { timeout: 300000 });
after(async () => { await browser?.close(); await app?.stop(); });

const withPage = async (user, opts, fn) => {
  const page = await drillPage(browser, url, user, opts);
  await recordProgress(page);
  try { await fn(page); } finally { await page.context().close(); }
};
const tomorrows = (before, lang) => [formatDay(before, lang), formatDay(utcDay(1), lang)];

// 1.e4 and, after each of the 20 black replies, 3.Nf3: 21 cards, all due.
const REPLIES = [
  'a7a6', 'a7a5', 'b7b6', 'b7b5', 'c7c6', 'c7c5', 'd7d6', 'd7d5', 'e7e6', 'e7e5',
  'f7f6', 'f7f5', 'g7g6', 'g7g5', 'h7h6', 'h7h5', 'b8a6', 'b8c6', 'g8f6', 'g8h6',
];
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const isStart = (fen) => fen.startsWith(START);

/** A user whose white repertoire is 1.e4 e5 2.Nf3, both cards due. */
async function whiteE4E5Nf3() {
  const user = await signedUpUser(url);
  await repertoireLine(url, user.token, 'white', ['e2e4', 'e7e5', 'g1f3']);
  return user;
}
/** Plays it: e4 wrong (d4) then right, Nf3 right. */
async function playWrongThenRight(page) {
  await openDrill(page, url, 'colour=white&seed=0');
  assert.equal(await shownPosition(page), fenAfter().split(' ').slice(0, 4).join(' '));
  await typeMove(page, 'd4');
  assert.ok(await waitForFeedback(page, 'The move was e4'));
  await typeMove(page, 'e4');
  assert.ok(await waitForPosition(page, fenAfter('e2e4', 'e7e5')));
  await typeMove(page, 'Nf3');
}

describe('a white repertoire with 21 due player cards, ?colour=white&seed=3', () => {
  test('after the 20th right answer drill-summary is shown: right 20, wrong 0, next due today; one card is still due', async () => {
    const user = await signedUpUser(url);
    for (const r of REPLIES) {
      const answers = await addLine(url, user.token, 'white', ['e2e4', r, 'g1f3']);
      assert.ok(answers.every((a) => a.status === 200 || a.status === 201), JSON.stringify(answers.map((a) => a.body)));
    }
    await withPage(user, {}, async (page) => {
      await openDrill(page, url, 'colour=white&seed=3');
      await playToSummary(page, (fen) => (isStart(fen) ? 'e2e4' : 'g1f3'));
      assert.ok(await waitForSummary(page));
      assert.equal(await boardShown(page), false, 'the summary replaces the board');
      const s = await summaryOf(page);
      assert.equal(s.right, 20);
      assert.equal(s.wrong, 0);
      assert.match(s.nextText, /today/i);
    });
    // The pick is weighted random: walk seeds until a line with a due move comes up.
    let due = [];
    for (let seed = 0; seed < 300 && due.length === 0; seed++) {
      due = movesOf(await requestDrill(url, user.token, { colour: 'white', seed })).filter((m) => m.due);
    }
    assert.equal(due.length, 1);
  });
});

describe('a white repertoire 1.e4 e5 2.Nf3, both cards due', () => {
  test('answering e4 wrong then right and Nf3 right ends the drill: right 1, wrong 1, next due tomorrow, progress reached 2/20', async () => {
    const user = await whiteE4E5Nf3();
    const before = utcDay(1);
    await withPage(user, {}, async (page) => {
      await playWrongThenRight(page);
      assert.ok(await waitForSummary(page));
      const s = await summaryOf(page);
      assert.equal(s.right, 1);
      assert.equal(s.wrong, 1);
      const dates = tomorrows(before, 'en');
      assert.ok(dates.some((d) => s.nextText.includes(d)), `${s.nextText} (expected one of ${dates})`);
      assert.ok(await progressEverReached(page, 2));
    });
  });

  test('drill-summary-back links to /openings, drill-summary-again to the white drill, which then shows drill-none with tomorrow', async () => {
    const user = await whiteE4E5Nf3();
    const before = utcDay(1);
    await withPage(user, {}, async (page) => {
      await playWrongThenRight(page);
      assert.ok(await waitForSummary(page));
      const s = await summaryOf(page);
      assert.equal(new URL(s.backHref, url).pathname, '/openings');
      const again = new URL(s.againHref, url);
      assert.equal(again.pathname, '/openings/drill');
      assert.equal(again.searchParams.get('colour'), 'white');
      await followAgain(page);
      await page.getByTestId('drill-none').waitFor({ state: 'visible' });
      const dates = tomorrows(before, 'en');
      const t = await noneText(page);
      assert.ok(dates.some((d) => t.includes(d)), `${t} (expected one of ${dates})`);
    });
  });

  test('with the lang cookie fr the labels and the date are in French', async () => {
    const user = await whiteE4E5Nf3();
    const before = utcDay(1);
    let fr;
    await withPage(user, { lang: 'fr' }, async (page) => {
      await openDrill(page, url, 'colour=white&seed=0');
      await typeMove(page, 'd4');
      await page.waitForFunction(() => (window.__feedback ?? []).length > 0);
      await typeMove(page, 'e4');
      assert.ok(await waitForPosition(page, fenAfter('e2e4', 'e7e5')));
      await typeMove(page, 'Cf3');
      assert.ok(await waitForSummary(page));
      fr = await summaryOf(page);
    });
    const dates = tomorrows(before, 'fr');
    assert.ok(dates.some((d) => fr.nextText.includes(d)), `${fr.nextText} (expected one of ${dates})`);
    const en = tomorrows(before, 'en');
    if (en.every((d) => !dates.includes(d))) assert.ok(en.every((d) => !fr.text.includes(d)), fr.text);
    assert.doesNotMatch(fr.text, /\b(right|wrong|today|Next due|Back|Again)\b/i, `labels not translated: ${fr.text}`);
  });

  test('at 375×812 there is no sideways scroll and the links are at least 44×44px', async () => {
    const user = await whiteE4E5Nf3();
    await withPage(user, { viewport: VIEWPORTS.mobile }, async (page) => {
      await playWrongThenRight(page);
      assert.ok(await waitForSummary(page));
      const h = await horizontalScroll(page);
      assert.ok(h.scrollWidth <= h.innerWidth, JSON.stringify(h));
      assert.deepEqual(await undersizedTargets(page), []);
    });
  });
});

describe('a white repertoire 1.e4 and a black repertoire 1.e4 c5, both due, ?colour=both&seed=0', () => {
  test('each line is played in its own colour, the summary shows right 2 and /openings shows "0 due today" on both cards', async () => {
    const user = await signedUpUser(url);
    await repertoireLine(url, user.token, 'white', ['e2e4']);
    await repertoireLine(url, user.token, 'black', ['e2e4', 'c7c5']);
    await withPage(user, {}, async (page) => {
      await openDrill(page, url, 'colour=both&seed=0');
      const prompts = await playToSummary(page, (fen) => (isStart(fen) ? 'e2e4' : 'c7c5'));
      assert.ok(prompts.some((p) => p.orientation === 'white' && isStart(p.fen)), JSON.stringify(prompts));
      assert.ok(prompts.some((p) => p.orientation === 'black' && !isStart(p.fen)), JSON.stringify(prompts));
      assert.ok(await waitForSummary(page));
      assert.equal((await summaryOf(page)).right, 2);
    });
    const home = await homeHtml(url, user.token);
    for (const colour of ['white', 'black']) {
      assert.equal(fieldOf(cardOf(home.html, colour), 'openings-due')?.text, '0 due today');
    }
  });
});
