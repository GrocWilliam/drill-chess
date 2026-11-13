// Domain layer for the import status line of /games (HTTP and browser). No assertions of a criterion here.
import { elementHtml, hasTestId } from './links.mjs';
import { pageText } from './accounts.mjs';
import { gameRows } from './games.mjs';

/** The text of `games-status` in server-rendered HTML ('' when absent). */
export const statusLine = (html) => (hasTestId(html, 'games-status') ? pageText(elementHtml(html, 'games-status')).trim() : '');

/** Whether the HTML holds `<meta http-equiv="refresh" content="2">` inside a <noscript>. */
export function hasNoscriptRefresh(html) {
  return [...html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi)].some((m) =>
    (m[1].match(/<meta\b[^>]*>/gi) ?? []).some(
      (t) => /http-equiv="refresh"/i.test(t) && /content="2"/.test(t),
    ),
  );
}

/** Whether the HTML has any http-equiv="refresh". */
export const hasAnyRefresh = (html) => /http-equiv=["']?refresh/i.test(html);

/** Browser: links chess.com `username` from the `games-empty` form. */
export async function linkFromEmptyState(page, username) {
  const form = page.getByTestId('games-empty').getByTestId('link-chesscom');
  await form.getByTestId('link-chesscom-username').fill(username);
  await form.getByTestId('link-chesscom-submit').click();
}

/** Browser: the text of `games-status` ('' when absent). */
export async function statusText(page) {
  const l = page.getByTestId('games-status');
  return (await l.count()) ? ((await l.first().textContent()) ?? '').replace(/[\s  ]+/g, ' ').trim() : '';
}

/** Browser: number of rows of the list. */
export const rowCount = (page) => gameRows(page).count();

/** Browser: polls (no fixed sleep) until `games-status` reads `text`; → the last text read. Survives page reloads. */
export async function waitForStatusText(page, text, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < end) {
    try { last = await statusText(page); } catch { /* page is navigating */ }
    if (last === text) return last;
    await new Promise((r) => setTimeout(r, 200));
  }
  return last;
}

/** Browser: records the time (ms) of every request to /api/import/status. Returns the live array. */
export function recordStatusPolls(page) {
  const times = [];
  page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/import/status') times.push(Date.now()); });
  return times;
}

/** Browser: counts the main-frame navigations after this call. Returns { count }. */
export function countNavigations(page) {
  const c = { count: 0 };
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) c.count++; });
  return c;
}
