// Domain layer for the end of a drill (US-94): drill-summary, and playing a drill to its end in the browser.
// Actions and reads only: no assertion of a criterion here.
import { allElements, attr } from './repertoire-page.mjs';
import { feedbackHistory, shownFen, boardOrientation, typeMove, waitForFeedback } from './drill-page.mjs';
import { currentDrillMoves } from './drill-page.mjs';

const BOARD = '[data-testid="drill-board"][data-fen], [data-testid="drill-board"] [data-fen]';
const squash = (t) => (t ?? '').replace(/[\s  ]+/g, ' ').trim();

/** Records every text drill-progress shows (it may vanish with the board). Call before opening the page. */
export async function recordProgress(page) {
  await page.addInitScript(() => {
    window.__progress = [];
    const look = () => {
      const el = document.querySelector('[data-testid="drill-progress"]');
      const t = el ? el.textContent.replace(/[\s  ]+/g, ' ').trim() : '';
      if (t && window.__progress[window.__progress.length - 1] !== t) window.__progress.push(t);
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

/** Whether drill-progress ever showed "N/20" as a whole token. */
export const progressEverReached = (page, n) =>
  page.evaluate((want) => window.__progress.some((t) => new RegExp(`(^|[^0-9])${want}(?![0-9])`).test(t)), `${n}/20`);

/** Waits (≤ 5 s) until drill-summary is visible → true, or false. */
export const waitForSummary = (page) => page.getByTestId('drill-summary').waitFor({ state: 'visible' }).then(() => true, () => false);

/** Whether the drill board is still in the page. */
export const boardShown = async (page) => (await page.locator('[data-testid="drill-board"]').count()) > 0;

const part = (page, id) => page.getByTestId('drill-summary').getByTestId(id);

/** The summary: { right, wrong (first integer of each), nextText, text, backHref, againHref }. */
export async function summaryOf(page) {
  const num = async (id) => {
    const m = /\d+/.exec(squash(await part(page, id).textContent()));
    return m ? Number(m[0]) : null;
  };
  return {
    right: await num('drill-summary-right'),
    wrong: await num('drill-summary-wrong'),
    nextText: squash(await part(page, 'drill-summary-next').textContent()),
    text: squash(await page.getByTestId('drill-summary').textContent()),
    backHref: await part(page, 'drill-summary-back').getAttribute('href'),
    againHref: await part(page, 'drill-summary-again').getAttribute('href'),
  };
}

/** Clicks drill-summary-again. */
export const followAgain = (page) => part(page, 'drill-summary-again').click();

/** The current text of drill-none, whitespace collapsed. */
export const noneText = async (page) => squash(await page.getByTestId('drill-none').textContent());

/**
 * Plays the drill to its end, answering each position where it is the player's turn with `answerFor(fen)` (a move
 * typed in board-move-input). Returns the prompts met: [{ fen, orientation }]. Stops when drill-summary shows.
 */
export async function playToSummary(page, answerFor, maxPrompts = 60) {
  const answered = [];
  const prompts = [];
  for (let i = 0; i < maxPrompts; i++) {
    const handle = await page
      .waitForFunction(
        ([sel, done]) => {
          if (document.querySelector('[data-testid="drill-summary"]')) return 'summary';
          const el = document.querySelector(sel.split(', ')[0]) ?? document.querySelector(sel.split(', ')[1]);
          const fen = el?.getAttribute('data-fen');
          const o = el?.getAttribute('data-orientation');
          if (!fen || !o) return false;
          const key = `${o}|${fen.split(' ').slice(0, 4).join(' ')}`;
          if (fen.split(' ')[1] === o[0] && !done.includes(key)) return JSON.stringify({ fen, o, key });
          return false;
        },
        [BOARD, answered],
      )
      .then((h) => h.jsonValue(), () => null);
    if (handle === 'summary') return prompts;
    if (!handle) throw new Error(`drill neither waits for a move nor ends; prompts so far: ${JSON.stringify(prompts)}`);
    const { fen, o, key } = JSON.parse(handle);
    answered.push(key);
    prompts.push({ fen, orientation: o });
    await typeMove(page, answerFor(fen));
  }
  throw new Error('drill did not end');
}

export { shownFen, boardOrientation, waitForFeedback, feedbackHistory, allElements, attr, currentDrillMoves };
