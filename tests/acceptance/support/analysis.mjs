// Browser domain layer for the in-browser analysis on the board page (GameReview, EvalBar, MoveList marks).
// Actions and reads only: no assertions of a criterion here.

const tid = (page, id) => page.getByTestId(id);

/** The longest an analysis of the demo may take (the story's limit). */
export const ANALYSIS_LIMIT_MS = 60000;

/**
 * Installs, before any page script runs, a recorder of every text `review-progress` shows, and a gate on the
 * engine: as soon as `review-progress` is in the page, the messages of the Stockfish worker are held (the analysis
 * pauses, nothing else changes) until `releaseEngine` is called. Call before the page is opened.
 */
export async function watchAnalysis(page, { holdWhileAnalysing = false } = {}) {
  await page.addInitScript((hold) => {
    window.__progressTexts = [];
    window.__engineHeld = hold;
    const record = () => {
      const el = document.querySelector('[data-testid="review-progress"]');
      if (el) {
        const text = el.textContent.replace(/[\s  ]+/g, ' ').trim();
        if (window.__progressTexts[window.__progressTexts.length - 1] !== text) window.__progressTexts.push(text);
      }
    };
    new MutationObserver(record).observe(document, { subtree: true, childList: true, characterData: true });
    const Orig = window.Worker;
    window.Worker = class extends Orig {
      constructor(...args) {
        super(...args);
        const listeners = new Set();
        let handler = null;
        const queue = [];
        const deliver = (e) => {
          handler?.call(this, e);
          for (const l of listeners) (typeof l === 'function' ? l : l.handleEvent).call(this, e);
        };
        const flush = () => {
          const held = window.__engineHeld && document.querySelector('[data-testid="review-progress"]');
          if (held) return setTimeout(flush, 20);
          while (queue.length) deliver(queue.shift());
        };
        super.addEventListener('message', (e) => {
          const copy = new MessageEvent('message', { data: e.data });
          queue.push(copy);
          if (queue.length === 1) flush();
        });
        Object.defineProperty(this, 'onmessage', { get: () => handler, set: (h) => (handler = h), configurable: true });
        this.addEventListener = (type, l, o) => (type === 'message' ? listeners.add(l) : super.addEventListener(type, l, o));
        this.removeEventListener = (type, l, o) => (type === 'message' ? listeners.delete(l) : super.removeEventListener(type, l, o));
      }
    };
  }, holdWhileAnalysing);
}

/** Lets a held engine go on (see watchAnalysis). */
export const releaseEngine = (page) => page.evaluate(() => { window.__engineHeld = false; });

/** Every distinct text `review-progress` showed since the page loaded (needs watchAnalysis). */
export const progressTexts = (page) => page.evaluate(() => window.__progressTexts ?? []);

/** Waits until `review-progress` shows. */
export const waitForProgress = (page) => tid(page, 'review-progress').waitFor({ state: 'visible' });
export const progressShown = async (page) => (await tid(page, 'review-progress').count()) > 0 && tid(page, 'review-progress').isVisible();

/**
 * Waits (≤ the story's 60 s) until the analysis is over: `review-progress` gone and the accuracies shown.
 * → true when it ended in time, false otherwise.
 */
export async function waitForAnalysisEnd(page) {
  // Fail fast: a page that shows neither progress, accuracies nor an error within 10 s has no analysis at all.
  const started = await page
    .waitForFunction(
      () => ['review-progress', 'review-accuracy-white', 'review-error'].some((id) => document.querySelector(`[data-testid="${id}"]`)),
      null,
      { timeout: 10000, polling: 100 },
    )
    .then(() => true, () => false);
  if (!started) return false;
  return page
    .waitForFunction(
      () => {
        const shown = (id) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          return !!el && el.getClientRects().length > 0;
        };
        if (shown('review-error')) return 'error';
        return !shown('review-progress') && shown('review-accuracy-white') && shown('review-accuracy-black');
      },
      null,
      { timeout: ANALYSIS_LIMIT_MS, polling: 100 },
    )
    .then(async (h) => (await h.jsonValue()) === true, () => false);
}

const clean = (s) => (s ?? '').replace(/[\s  ]+/g, ' ').trim();

/** The text of the best-move element, without its "Best move" / "Meilleur coup" label: the move, or ''. */
export async function bestMove(page) {
  const text = clean(await tid(page, 'review-best').textContent());
  return text.replace(/^(Best move|Meilleur coup)\s*:?\s*/i, '').trim();
}

/** The eval bar → { valueNow (number or null), valueMin, valueMax, role, text }. */
export async function evalBar(page) {
  const bar = tid(page, 'eval-bar');
  const num = async (a) => {
    const v = await bar.getAttribute(a);
    return v === null ? null : Number(v);
  };
  return {
    role: await bar.getAttribute('role'),
    valueNow: await num('aria-valuenow'),
    valueMin: await num('aria-valuemin'),
    valueMax: await num('aria-valuemax'),
    text: clean(await bar.innerText()),
  };
}

/** The text of the accuracy block (`review-accuracy`), whitespace collapsed. */
export const accuracyText = async (page) => clean(await tid(page, 'review-accuracy').innerText());

/** The numbers written in `review-accuracy-<side>` ('white' | 'black') → every number token of its text, as written. */
export async function accuracyNumbers(page, side) {
  const text = clean(await tid(page, `review-accuracy-${side}`).innerText());
  return text.match(/\d+(?:[.,]\d+)*/g) ?? [];
}

/** Every move of the list → [{ ply, label, text }] (text = what the button shows, whitespace removed). */
export async function markedMoves(page) {
  return page.getByTestId('move-list').locator('[data-testid="move"]').evaluateAll((els) =>
    els.map((e) => ({
      ply: Number(e.getAttribute('data-ply')),
      label: e.getAttribute('aria-label'),
      text: e.textContent.replace(/[\s  ]+/g, ''),
    })),
  );
}

/** Makes `/stockfish/stockfish.js` answer 404 for this page's context (the worker fails to load). */
export async function breakEngineFile(page) {
  const isEngine = (url) => new URL(url).pathname === '/stockfish/stockfish.js';
  const handler = (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
  await page.context().route(isEngine, handler);
  return () => page.context().unroute(isEngine, handler);
}

/** The analysis error → { shown, role, text, retryShown, retryText }. */
export async function analysisError(page) {
  const err = tid(page, 'review-error');
  const retry = tid(page, 'review-retry');
  const shown = (await err.count()) > 0 && (await err.isVisible());
  return {
    shown,
    role: shown ? await err.getAttribute('role') : null,
    text: shown ? clean(await err.innerText()) : '',
    retryShown: (await retry.count()) > 0 && (await retry.isVisible()),
    retryText: (await retry.count()) > 0 ? clean(await retry.innerText()) : '',
  };
}
export const waitForAnalysisError = (page) => tid(page, 'review-error').waitFor({ state: 'visible' }).then(() => true, () => false);
export const clickRetry = (page) => tid(page, 'review-retry').click();
