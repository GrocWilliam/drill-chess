// Domain layer for the endgame board page /endgames/<id> (US-111): HTTP reads and browser actions.
// Reads and actions only: no assertion of a criterion here.
import { visitAs } from './accounts.mjs';
import { visit } from './visitor.mjs';
import { allElements, text } from './repertoire-page.mjs';
import { pageText } from './accounts.mjs';
import { newVisitorPage } from './pages.mjs';
import { savePreferences } from './preferences.mjs';
import { dragPiece, typeMove, boardFen, boardOrientation } from './board.mjs';

export { dragPiece, typeMove, boardFen, boardOrientation };

export const endgamePageAsVisitor = (baseUrl, id) => visit(baseUrl, { path: `/endgames/${id}` });
export const endgamePageHtml = (baseUrl, token, id, opts = {}) => visitAs(baseUrl, token, { path: `/endgames/${id}`, ...opts });

const norm = (s) => s.replace(/[\s  ]+/g, ' ').trim();

/** The server-rendered page → { fen, orientation, name, goal, lesson, moves: [san], status, hasBackLink, backHref }. */
export function endgameFacts(html) {
  const board = /<[^>]*data-testid="board"[^>]*>/.exec(html)?.[0] ?? '';
  const field = (id) => { const e = allElements(html, id)[0]; return e ? norm(text(e.inner)) : null; };
  const movesEl = allElements(html, 'endgame-moves')[0];
  const back = allElements(html, 'endgame-back')[0];
  return {
    fen: /data-fen="([^"]*)"/.exec(board)?.[1] ?? null,
    orientation: /data-orientation="([^"]*)"/.exec(board)?.[1] ?? null,
    name: field('endgame-name'),
    goal: field('endgame-goal'),
    lesson: field('endgame-lesson'),
    moves: movesEl ? allElements(movesEl.inner, 'endgame-move').map((m) => norm(text(m.inner))) : null,
    status: field('endgame-status'),
    backHref: back ? (/\bhref="([^"]*)"/.exec(back.open)?.[1] ?? null) : null,
  };
}

/** Whether the error page holds a link to `href`. */
export const hasLinkTo = (html, href) => new RegExp(`<a\\b[^>]*href="${href}"`).test(html);
export { pageText };

// ---- browser ----
/** A signed-in page; a `lang` is stored in the user's preferences (the stored language wins over the cookie). */
export async function endgamePlayPage(browser, baseUrl, user, { lang, viewport } = {}) {
  if (lang) await savePreferences(baseUrl, user.token, { lang, theme: 'system' });
  return newVisitorPage(browser, { baseUrl, session: user.token, lang, acceptLanguage: lang === 'fr' ? 'fr-FR' : 'en-US', viewport });
}

export async function openEndgame(page, baseUrl, id) {
  await page.goto(`${baseUrl}/endgames/${id}`, { waitUntil: 'networkidle' });
  await page.getByTestId('board').locator('piece').first().waitFor({ state: 'attached' });
}

const t = (page, id) => page.getByTestId(id);
export const nameShown = async (page) => norm(await t(page, 'endgame-name').innerText());
export const goalShown = async (page) => norm(await t(page, 'endgame-goal').innerText());
export const lessonShown = async (page) => norm(await t(page, 'endgame-lesson').innerText());
export const statusShown = async (page) => norm(await t(page, 'endgame-status').innerText());
export const retryLabel = async (page) => norm(await t(page, 'endgame-retry').innerText());
export const backLabel = async (page) => norm(await t(page, 'endgame-back').innerText());
export const movesShown = async (page) => (await t(page, 'endgame-moves').getByTestId('endgame-move').allInnerTexts()).map(norm);
export const pressRetry = (page) => t(page, 'endgame-retry').click();
export const clickBack = (page) => t(page, 'endgame-back').click();
/** Piece placement field of the board FEN, and whether a given piece sits on a square (e.g. 'Q','d4'). */
export async function pieceOn(page, square) {
  const ranks = (await boardFen(page)).split(' ')[0].split('/');
  const row = ranks[8 - Number(square[1])];
  let col = 0;
  for (const ch of row) {
    if (/\d/.test(ch)) col += Number(ch);
    else { if (col === square.charCodeAt(0) - 97) return ch; col++; }
  }
  return null;
}

/** Top-left boxes of the board and the panel's name → { board, name }. */
export async function boxes(page) {
  return { board: await t(page, 'board').boundingBox(), name: await t(page, 'endgame-name').boundingBox() };
}
export const attemptsRequests = (page) => {
  const urls = [];
  page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/endgames/kq-k/attempts') urls.push(r.url()); });
  return urls;
};

import { readFileSync } from 'node:fs';
/** The catalog lesson of endgame `id` in `lang` ('en' | 'fr'). */
export const lessonText = (lang, id) =>
  norm(JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/${lang}.json`, import.meta.url), 'utf8'))[`endgame.${id}.lesson`]);

// ---- US-112: playing an attempt against tablebase replies ----
const moveCount = (page) => t(page, 'endgame-moves').getByTestId('endgame-move').count();

/** Waits (≤ 5 s) until the moves list holds `n` moves; returns how many it holds then. */
export async function waitForMoveCount(page, n) {
  await page
    .waitForFunction((k) => document.querySelectorAll('[data-testid="endgame-moves"] [data-testid="endgame-move"]').length === k, n)
    .catch(() => {});
  return moveCount(page);
}

/** Plays `san` in the typed-move field (the player's move only; the reply comes on its own). */
export const playMove = (page, san) => typeMove(page, san);

/** Plays `san` and waits until the app's reply is in the moves list (2 more moves than before). → moves count;
 * throws when no reply comes within 5 s (the line cannot go on). */
export async function playAndAwaitReply(page, san) {
  const before = await moveCount(page);
  await typeMove(page, san);
  const n = await waitForMoveCount(page, before + 2);
  if (n !== before + 2) throw new Error(`no reply after ${san}: ${n} moves listed, ${before + 2} expected (status: ${await statusShown(page)})`);
  return n;
}

/** Whether a reply joins the moves list within 1 s (it is due 300 ms after the move). → moves count after that */
export async function moveCountAfterQuiet(page) {
  const before = await moveCount(page);
  await page
    .waitForFunction((k) => document.querySelectorAll('[data-testid="endgame-moves"] [data-testid="endgame-move"]').length !== k, before, { timeout: 1000 })
    .catch(() => {});
  return moveCount(page);
}

/** The moves marked failing (`data-failed="true"`) in the moves list, as text. */
export const failedMoves = async (page) =>
  (await t(page, 'endgame-moves').locator('[data-testid="endgame-move"][data-failed="true"]').allInnerTexts()).map(norm);

/** Waits (≤ 5 s) until the status reads `text` (whitespace normalised); returns the status shown then. */
export async function waitForStatus(page, text) {
  await page
    .waitForFunction(
      (want) => (document.querySelector('[data-testid="endgame-status"]')?.textContent ?? '').replace(/[\s  ]+/g, ' ').trim() === want,
      text,
    )
    .catch(() => {});
  return statusShown(page);
}

/** Tries to move a piece from `from` to `to` on the board with the mouse, and by typing `san` when the field is usable. */
export async function tryToMove(page, from, to, san) {
  await dragPiece(page, from, to);
  const field = page.getByTestId('board-move-input');
  if ((await field.count()) && (await field.isVisible()) && (await field.isEditable())) await typeMove(page, san);
}

/** Whether the "Try again" control (`endgame-retry-move`) is shown; its label; pressing it. */
export async function retryMoveShown(page) {
  const el = t(page, 'endgame-retry-move');
  await el.waitFor({ state: 'visible' }).catch(() => {});
  return (await el.count()) > 0 && el.isVisible();
}
export const retryMoveLabel = async (page) => norm(await t(page, 'endgame-retry-move').innerText());
export const pressTryAgain = (page) => t(page, 'endgame-retry-move').click();

/**
 * Records the page's POSTs to /api/endgames/<id>/attempts: a live array of { body (sent JSON), answer: Promise<JSON|null> }.
 */
export function attemptPosts(page, id) {
  const posts = [];
  page.on('request', (r) => {
    if (r.method() !== 'POST' || new URL(r.url()).pathname !== `/api/endgames/${id}/attempts`) return;
    let body = null;
    try { body = r.postDataJSON(); } catch { body = r.postData(); }
    const answer = r.response().then((res) => (res ? res.json().catch(() => null) : null));
    posts.push({ body, answer });
  });
  return posts;
}

/** Waits (≤ 5 s) until `posts` holds `n` entries, then 1 s more for any extra one; returns the entries. */
export async function settledPosts(posts, n) {
  const deadline = Date.now() + 5000;
  while (posts.length < n && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  const seen = posts.length;
  const quiet = Date.now() + 1000;
  while (posts.length === seen && Date.now() < quiet) await new Promise((r) => setTimeout(r, 50));
  return [...posts];
}

/** Records the answers of /api/endgames/<id>/reply the page got: a live array of { fen, status, body }. */
export function replyAnswers(page, id) {
  const out = [];
  page.on('response', async (res) => {
    const u = new URL(res.url());
    if (u.pathname !== `/api/endgames/${id}/reply`) return;
    const entry = { fen: u.searchParams.get('fen'), status: res.status(), body: null };
    out.push(entry);
    entry.body = await res.json().catch(() => null);
  });
  return out;
}

/** The FEN after each step of a line (from ./fakes/tablebase.mjs), and the moves list it should give, SAN without +/#. */
export { LINES, lineFens, holdingLine, afterFakeReply } from './fakes/tablebase.mjs';
export const sanShown = (san) => san.replace(/[+#]$/, '');
