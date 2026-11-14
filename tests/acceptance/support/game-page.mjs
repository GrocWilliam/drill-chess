// Domain layer for reviewing an imported game on /games/<id> (US-50): the fake's `review_rook` games, opening the
// board page signed in, watching the analysis saves, failing them, and the no-JavaScript HTML.
// Actions and reads only: no assertions of a criterion here.
import { Chess } from 'chess.js';
import { pageText } from './accounts.mjs';
import { archiveGames, utcMonth } from './fakes/chesscom-games.mjs';
import { gameIdByNumber, postAnalysis, zerosBody } from './review.mjs';
import { waitForImportEnd } from './imports.mjs';
import { elementHtml, linkAccount } from './links.mjs';
import { newVisitorPage, VIEWPORTS } from './pages.mjs';

/** The fake's `review_rook` games: U played Black in BLACK (13 plies, ends in mate), White in WHITE (4 plies). */
export const REVIEW_PLAYER = 'review_rook';
export const REVIEW_BLACK_GAME = '97500001';
export const REVIEW_WHITE_GAME = '97500002';

/** The fake's PGN of the chess.com game `number` of `player` (month 0). */
export function fakeGamePgn(player, number) {
  const { year, month } = utcMonth(0);
  return archiveGames(player, year, month).find((g) => g.url.endsWith(`/${number}`)).pgn;
}

/** What a PGN holds → { plies, sans }. */
function facts(pgn) {
  const c = new Chess();
  c.loadPgn(pgn);
  const sans = c.history();
  return { plies: sans.length, sans };
}

/**
 * Links chess.com `review_rook` for `user`, waits for the import and finds both games.
 * → { black: { id, pgn, plies, sans }, white: { ... } } (black = the game U played Black = G).
 */
export async function importReviewGames(baseUrl, user) {
  const r = await linkAccount(baseUrl, user.token, { site: 'chesscom', username: REVIEW_PLAYER });
  if (r.status !== 303) throw new Error(`setup: linking chess.com ${REVIEW_PLAYER} gave ${r.status}`);
  const job = await waitForImportEnd(baseUrl, user.token, 'chesscom', 20000);
  if (job?.status !== 'done') throw new Error(`setup: the import did not end done: ${JSON.stringify(job)}`);
  const game = async (number) => {
    const pgn = fakeGamePgn(REVIEW_PLAYER, number);
    return { id: await gameIdByNumber(baseUrl, user.token, number), pgn, ...facts(pgn) };
  };
  return { black: await game(REVIEW_BLACK_GAME), white: await game(REVIEW_WHITE_GAME) };
}

/** Stores an analysis of `game` over HTTP (every eval 0, no best move): the game is then "analysed". */
export async function storeZerosAnalysis(baseUrl, user, game) {
  const r = await postAnalysis(baseUrl, user.token, game.id, zerosBody(game.plies));
  if (r.status !== 201) throw new Error(`setup: storing an analysis gave ${r.status} ${JSON.stringify(r.body)}`);
}

/** A signed-in page of `user` (own context). opts: { lang, viewport } */
export function signedInPage(browser, baseUrl, user, { lang, viewport = VIEWPORTS.desktop } = {}) {
  return newVisitorPage(browser, {
    baseUrl,
    session: user.token,
    lang,
    acceptLanguage: lang === 'fr' ? 'fr-FR' : 'en-US',
    viewport,
  });
}

/** Opens /games/<id> (with ?ply=<ply> when given) and waits until the board is live. */
export async function openGamePage(page, baseUrl, id, ply) {
  const q = ply === undefined ? '' : `?ply=${ply}`;
  await page.goto(`${baseUrl}/games/${id}${q}`, { waitUntil: 'load' });
  await page.getByTestId('board').locator('piece').first().waitFor({ state: 'attached' });
}

/** Reloads the page and waits until the board is live and the network is quiet (an engine would have loaded). */
export async function reloadGamePage(page) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('board').locator('piece').first().waitFor({ state: 'attached' });
}

const isAnalysisUrl = (id) => (url) => new URL(url).pathname === `/api/games/${id}/analysis`;

/**
 * Records every request to /api/games/<id>/analysis made by the page (call before opening it).
 * → live array of { method, body (parsed JSON or null), status (null until answered, 'failed' on a network error),
 *   answer (parsed JSON or null) }.
 */
export function recordAnalysisRequests(page, id) {
  const calls = [];
  const byRequest = new Map();
  const match = isAnalysisUrl(id);
  page.on('request', (req) => {
    if (!match(req.url())) return;
    let body = null;
    try {
      body = JSON.parse(req.postData() ?? 'null');
    } catch {
      body = null;
    }
    const call = { method: req.method(), body, status: null, answer: null };
    byRequest.set(req, call);
    calls.push(call);
  });
  page.on('response', async (res) => {
    const call = byRequest.get(res.request());
    if (!call) return;
    let answer = null;
    try {
      answer = await res.json();
    } catch {
      answer = null;
    }
    call.answer = answer;
    call.status = res.status();
  });
  page.on('requestfailed', (req) => {
    const call = byRequest.get(req);
    if (call) call.status = 'failed';
  });
  return calls;
}

/** Waits (≤ 70 s: the analysis runs first) until `calls` holds `n` answered (or failed) requests → true, else false. */
export async function waitForAnsweredRequests(calls, n, ms = 70000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (calls.filter((c) => c.status !== null).length >= n) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

/** Makes /api/games/<id>/analysis answer 500 (as `{error}` JSON) for this page → a function removing it. */
export async function failAnalysisSaves(page, id) {
  const match = isAnalysisUrl(id);
  const handler = (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'internal', message: 'Injected by the test.' } }),
    });
  await page.route(match, handler);
  return () => page.unroute(match, handler);
}

/** Makes /api/games/<id>/analysis fail at the network level for this page → a function removing it. */
export async function cutAnalysisSaves(page, id) {
  const match = isAnalysisUrl(id);
  const handler = (route) => route.abort('connectionfailed');
  await page.route(match, handler);
  return () => page.unroute(match, handler);
}

/** Forgets the progress texts recorded so far (see analysis.mjs `watchAnalysis`). */
export const forgetProgressTexts = (page) => page.evaluate(() => { window.__progressTexts = []; });

export const clickReanalyse = (page) => page.getByTestId('review-reanalyse').click();
export const reanalyseText = async (page) =>
  (await page.getByTestId('review-reanalyse').innerText()).replace(/[\s  ]+/g, ' ').trim();

/** Waits until the board's data-orientation is `o` → true, or false after the default timeout. */
export const waitForOrientation = (page, o) =>
  page
    .waitForFunction((v) => document.querySelector('[data-testid="board"]')?.getAttribute('data-orientation') === v, o)
    .then(() => true, () => false);

/** The <noscript> blocks of the page's body (server HTML) → [{ text, movesText }] (movesText of game-moves inside, or null). */
export function noscriptBlocks(html) {
  const body = html.slice(html.search(/<body\b/i));
  return [...body.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi)].map((m) => {
    const moves = elementHtml(m[1], 'game-moves');
    return { text: pageText(m[1]).trim(), movesText: moves == null ? null : pageText(moves).trim() };
  });
}
