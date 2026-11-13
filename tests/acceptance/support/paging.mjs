// Domain layer for paging the games list with the fake Lichess user many_pawns (5,005 games).
// No assertions of a criterion here: helpers return values, tests compare them.
import { signedUpUser, visitAs } from './accounts.mjs';
import { listedGames } from './games.mjs';
import { elementHtml, hasTestId, linkAccount } from './links.mjs';
import { waitForImportEnd } from './imports.mjs';
import { manyId } from './fakes/lichess-games.mjs';

export { manyId };

/** Signs up, links many_pawns and waits (90 s max) for the job → { user, job }. */
export async function userWithManyGames(env) {
  const user = await signedUpUser(env.app.url);
  const r = await linkAccount(env.app.url, user.token, { site: 'lichess', username: 'many_pawns' });
  if (r.status !== 303) throw new Error(`setup: linking many_pawns failed (${r.status})`);
  const job = await waitForImportEnd(env.app.url, user.token, 'lichess', 90000);
  return { user, job };
}

/** GET /games?<query> → { status, html, rows, prevHref, nextHref, hasNone }. */
export async function openPage(baseUrl, token, query = '', opts = {}) {
  const r = await visitAs(baseUrl, token, { ...opts, path: `/games${query ? `?${query}` : ''}` });
  return { ...r, rows: listedGames(r.html), prevHref: linkHref(r.html, 'games-prev'), nextHref: linkHref(r.html, 'games-next'), hasNone: hasTestId(r.html, 'games-none') };
}

/** The href of the link with data-testid `testid` (null when absent or without href). */
export function linkHref(html, testid) {
  const open = new RegExp(`<a\\b[^>]*\\bdata-testid="${testid}"[^>]*>`).exec(html)?.[0];
  if (!open) return null;
  return /\bhref="([^"]*)"/.exec(open)?.[1]?.replaceAll('&amp;', '&') ?? null;
}

/** Whether an element with data-testid `testid` is on the page (link or button). */
export const hasControl = (html, testid) => hasTestId(html, testid);

/** The site link (https://lichess.org/mpNNNNNN) of every listed row, found by opening each row's game page. */
export async function rowSiteLinks(baseUrl, token, rows) {
  return Promise.all(rows.map(async (row) => {
    const href = row.hrefs.find((h) => /^\/games\/[^/?#]+$/.test(h));
    if (!href) return null;
    const r = await visitAs(baseUrl, token, { path: href });
    const open = /<a\b[^>]*\bdata-testid="game-site-link"[^>]*>/.exec(r.html)?.[0];
    return open ? /\bhref="([^"]*)"/.exec(open)?.[1] ?? null : null;
  }));
}

/** The site link expected for game number n. */
export const siteLinkOf = (n) => `https://lichess.org/${manyId(n)}`;

/** Whether a row's text holds the Blitz label. */
export const isBlitzRow = (row) => row.text.split(/[\s  ]+/).includes('Blitz');

// ---- browser ----
export const pressNext = (page) => page.getByTestId('games-next').click();
export const pressPrev = (page) => page.getByTestId('games-prev').click();
export const currentPage = (page) => new URL(page.url()).searchParams.get('page');
export const pagingBoxes = (page) => page.evaluate(() =>
  ['games-next', 'games-prev'].map((id) => document.querySelector(`[data-testid="${id}"]`)).filter(Boolean).map((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  }));
export const firstRowGameId = (page) => page.locator('[data-testid="games-row"]').first().getAttribute('data-game-id');
export const rowsCount = (page) => page.locator('[data-testid="games-row"]').count();
