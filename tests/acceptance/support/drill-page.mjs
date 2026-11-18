// Domain layer for the drill page /openings/drill (US-93): HTTP reads of the server-rendered page, setup of
// repertoires whose cards are due or not, and browser actions and reads on the drill. No assertion of a criterion here.
import { visitAs } from './accounts.mjs';
import { savePreferences } from './preferences.mjs';
import { newVisitorPage } from './pages.mjs';
import { allElements, attr, text } from './repertoire-page.mjs';
import { buildRepertoire, movesOf, requestDrill, reviewAll } from './drill.mjs';

// ---- setup over HTTP ----

/**
 * Builds a repertoire of one line (UCI moves from the start) and returns its drill moves as served by
 * GET /api/openings/drill (with their card ids): [{ uci, san, by, cardId, due }].
 */
export async function repertoireLine(baseUrl, token, colour, line) {
  await buildRepertoire(baseUrl, token, colour, [line]);
  const a = await requestDrill(baseUrl, token, { colour, seed: 0 });
  if (a.status !== 200) throw new Error(`setup: drill of ${line.join(' ')} gave ${a.status}`);
  return movesOf(a);
}

/** Reviews correct (→ due tomorrow) the cards of the given drill moves (those with a cardId). */
export const reviewMovesCorrect = (baseUrl, token, moves) =>
  reviewAll(baseUrl, token, moves.filter((m) => m.cardId).map((m) => ({ id: m.cardId })));

/** The drill moves of the user's current line for `colour` (GET /api/openings/drill, no seed). */
export async function currentDrillMoves(baseUrl, token, colour) {
  return movesOf(await requestDrill(baseUrl, token, { colour }));
}

// ---- HTTP reads ----

/** GET /openings/drill?<query> signed in (lang stored as the user's preference and as cookie) → { status, location, html }. */
export async function drillHtml(baseUrl, user, query = '', { lang } = {}) {
  if (lang) await savePreferences(baseUrl, user.token, { lang, theme: 'system' });
  return visitAs(baseUrl, user.token, { path: `/openings/drill${query ? `?${query}` : ''}`, cookies: lang ? { lang } : {} });
}

/** GET /openings/drill as a signed-out visitor → { status, location }. */
export async function drillAsVisitor(baseUrl) {
  const r = await fetch(`${baseUrl}/openings/drill`, { redirect: 'manual' });
  await r.text();
  return { status: r.status, location: r.headers.get('location') };
}

/** `drill-none` of server-rendered HTML → { text (whole block, whitespace collapsed), editHref } or null when absent. */
export function nothingDueOf(html) {
  const e = allElements(html, 'drill-none')[0];
  if (!e) return null;
  const link = allElements(e.inner, 'drill-none-edit')[0] ?? allElements(html, 'drill-none-edit')[0];
  return { text: text(e.inner), editHref: link ? attr(link.open, 'href') : null };
}

/** The path of a link href (resolved against a dummy origin). */
export const pathOf = (href) => (href == null ? null : new URL(href, 'http://x').pathname + new URL(href, 'http://x').search);

/** A YYYY-MM-DD day formatted as the games list formats dates: Intl.DateTimeFormat(lang, { timeZone: 'UTC' }). */
export const formatDay = (day, lang) => new Intl.DateTimeFormat(lang, { timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

// ---- browser ----

const BOARD = '[data-testid="drill-board"][data-fen], [data-testid="drill-board"] [data-fen]';

/**
 * A signed-in page of `user` that records every text `drill-feedback` shows (a short "Correct" may vanish fast) and
 * every card review the page sends. opts: { lang, viewport }
 */
export async function drillPage(browser, baseUrl, user, { lang, viewport } = {}) {
  if (lang) await savePreferences(baseUrl, user.token, { lang, theme: 'system' });
  const page = await newVisitorPage(browser, {
    baseUrl, session: user.token, lang, viewport, acceptLanguage: lang === 'fr' ? 'fr-FR' : 'en-US',
  });
  await page.addInitScript(() => {
    window.__feedback = [];
    const look = () => {
      const el = document.querySelector('[data-testid="drill-feedback"]');
      const t = el ? el.textContent.replace(/[\s  ]+/g, ' ').trim() : '';
      if (t && window.__feedback[window.__feedback.length - 1] !== t) window.__feedback.push(t);
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  const reviews = [];
  const drillRequests = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname === '/api/openings/drill') drillRequests.push(Object.fromEntries(u.searchParams));
    const m = /^\/api\/openings\/cards\/([^/]+)\/review$/.exec(u.pathname);
    if (m && r.method() === 'POST') {
      let body = null;
      try { body = JSON.parse(r.postData() ?? ''); } catch { body = null; }
      const entry = { cardId: decodeURIComponent(m[1]), body, status: null, card: null };
      entry.done = r.response().then(async (res) => {
        if (!res) return;
        entry.status = res.status();
        try { entry.card = (await res.json()).card ?? null; } catch { entry.card = null; }
      }).catch(() => {});
      reviews.push(entry);
    }
  });
  page.drill = { reviews, drillRequests };
  return page;
}

/** Opens /openings/drill?<query> and waits until the board is live (chessground drew its pieces). */
export async function openDrill(page, baseUrl, query = '') {
  await page.goto(`${baseUrl}/openings/drill${query ? `?${query}` : ''}`, { waitUntil: 'networkidle' });
  await page.locator(BOARD).first().locator('piece').first().waitFor({ state: 'attached' });
}

const board = (page) => page.locator(BOARD).first();
const fenKey = (fen) => (fen ?? '').split(' ').slice(0, 4).join(' ');

/** The position shown on the drill board (first four FEN fields) and its orientation. */
export const shownPosition = async (page) => fenKey(await board(page).getAttribute('data-fen'));
export const shownFen = (page) => board(page).getAttribute('data-fen');
export const boardOrientation = (page) => board(page).getAttribute('data-orientation');

/** Waits (≤ 5 s) until the drill board shows the position of `fen` → true, or false when it never does. */
export async function waitForPosition(page, fen) {
  return page
    .waitForFunction(
      ([sel, want]) => {
        const el = document.querySelector(sel.split(', ')[0]) ?? document.querySelector(sel.split(', ')[1]);
        return (el?.getAttribute('data-fen') ?? '').split(' ').slice(0, 4).join(' ') === want;
      },
      [BOARD, fenKey(fen)],
    )
    .then(() => true, () => false);
}

/**
 * Whether the board keeps its position for `ms` (default 1500 ms, five times the 300 ms between automatic moves):
 * how a test sees that the drill waits for the player. Waits for a change and gives up after `ms`.
 */
export async function positionStays(page, ms = 1500) {
  const before = await shownFen(page);
  const changed = await page
    .waitForFunction(
      ([sel, prev]) => {
        const el = document.querySelector(sel.split(', ')[0]) ?? document.querySelector(sel.split(', ')[1]);
        return el?.getAttribute('data-fen') !== prev;
      },
      [BOARD, before],
      { timeout: ms },
    )
    .then(() => true, () => false);
  return !changed;
}

/** Types `move` (SAN or UCI) in board-move-input and presses Enter. */
export async function typeMove(page, move) {
  const input = page.getByTestId('board-move-input');
  await input.fill(move);
  await input.press('Enter');
}

/** The current text of drill-feedback ('' when absent), whitespace collapsed. */
export async function feedbackText(page) {
  const e = page.getByTestId('drill-feedback');
  if (!(await e.count())) return '';
  return (await e.textContent()).replace(/[\s  ]+/g, ' ').trim();
}

/** Waits (≤ 5 s) until drill-feedback has shown `wanted` at some point → true, or false. */
export const waitForFeedback = (page, wanted) =>
  page.waitForFunction((w) => (window.__feedback ?? []).includes(w), wanted).then(() => true, () => false);

/** Every text drill-feedback showed since the page opened, in order. */
export const feedbackHistory = (page) => page.evaluate(() => [...(window.__feedback ?? [])]);

/** The text of drill-progress, whitespace collapsed. */
export const progressText = async (page) => (await page.getByTestId('drill-progress').textContent()).replace(/[\s  ]+/g, ' ').trim();

/** Waits (≤ 5 s) until drill-progress holds "N/20" for this N as a whole token → true, or false. */
export const waitForProgress = (page, n) =>
  page
    .waitForFunction(
      (want) => new RegExp(`(^|[^0-9])${want}(?![0-9])`).test(document.querySelector('[data-testid="drill-progress"]')?.textContent ?? ''),
      `${n}/20`,
    )
    .then(() => true, () => false);

/** The opening name shown (opening-name), whitespace collapsed. */
export const shownOpeningName = async (page) => (await page.getByTestId('opening-name').textContent()).replace(/[\s  ]+/g, ' ').trim();

/** The arrows drawn on the drill board → [{ orig, dest }] (chessground's shapes layer). */
export function arrows(page) {
  return board(page).evaluate((el) => {
    const root = el.closest('.cg-wrap') ?? el.querySelector('.cg-wrap') ?? el;
    const out = [];
    for (const g of root.querySelectorAll('svg.cg-shapes g')) {
      const hash = g.getAttribute('cgHash') ?? g.getAttribute('cghash');
      if (!hash || !g.querySelector('line')) continue;
      const m = /(?:^|,)([a-h][1-8]),([a-h][1-8])(?:,|$)/.exec(hash);
      if (m) out.push({ orig: m[1], dest: m[2] });
    }
    return out;
  });
}

/** Waits (≤ 5 s) until an arrow from `orig` to `dest` is drawn → true, or false. */
export async function waitForArrow(page, orig, dest) {
  for (const t0 = Date.now(); Date.now() - t0 < 5000; ) {
    if ((await arrows(page)).some((a) => a.orig === orig && a.dest === dest)) return true;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  }
  return false;
}

/** The card reviews the page sent → [{ cardId, body, status, card }] (responses awaited). */
export async function sentReviews(page) {
  await Promise.all(page.drill.reviews.map((r) => r.done));
  return page.drill.reviews.map(({ cardId, body, status, card }) => ({ cardId, body, status, card }));
}

/** Waits (≤ ms) until the page has sent at least `n` reviews → true, or false. */
export async function waitForReviews(page, n, ms = 5000) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; ) {
    if (page.drill.reviews.length >= n) return true;
    await page.waitForTimeout(50);
  }
  return page.drill.reviews.length >= n;
}

/** The queries of the GET /api/openings/drill requests the page sent → [{ colour, seed, … }]. */
export const drillRequests = (page) => [...page.drill.drillRequests];

/** Waits (≤ 5 s) until `drill-none` is shown → true, or false. */
export const waitForNothingDue = (page) => page.getByTestId('drill-none').waitFor({ state: 'visible' }).then(() => true, () => false);

/** Layout: boxes of the board and of the panel (the widest ancestor of drill-progress not holding the board). */
export function boardAndPanelBoxes(page) {
  return page.evaluate((sel) => {
    const board = document.querySelector(sel.split(', ')[0]) ?? document.querySelector(sel.split(', ')[1]);
    let panel = document.querySelector('[data-testid="drill-progress"]');
    while (panel.parentElement && !panel.parentElement.contains(board)) panel = panel.parentElement;
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    return { board: r(board), panel: r(panel) };
  }, BOARD);
}
