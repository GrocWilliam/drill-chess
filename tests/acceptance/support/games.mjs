// Domain layer for the games list and a game's details (HTTP and browser). No assertions of a criterion here:
// helpers return values, tests compare them.
import { pageText, visitAs } from './accounts.mjs';
import { elementHtml } from './links.mjs';
import { archiveGames, utcMonth } from './fakes/chesscom-games.mjs';
import { lastMoveAtOf } from './fakes/lichess-games.mjs';

/** GET /games signed in → { status, location, html }. */
export const openGames = (baseUrl, token, opts = {}) => visitAs(baseUrl, token, { ...opts, path: '/games' });

/** GET /games/<id> signed in → { status, location, html }. */
export const openGame = (baseUrl, token, id, opts = {}) => visitAs(baseUrl, token, { ...opts, path: `/games/${id}` });

/** Every element of the HTML carrying data-testid="<testid>": [{ tag, open, inner }] (open = its opening tag). */
function elementsOf(html, testid) {
  const out = [];
  const openRe = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\bdata-testid="${testid}"[^>]*>`, 'g');
  for (let m; (m = openRe.exec(html)); ) {
    const re = new RegExp(`<(/?)${m[1]}\\b[^>]*>`, 'g');
    re.lastIndex = m.index + m[0].length;
    let depth = 1;
    let end = html.length;
    for (let c; (c = re.exec(html)); ) {
      depth += c[1] ? -1 : /\/>$/.test(c[0]) ? 0 : 1;
      if (depth === 0) { end = c.index; break; }
    }
    out.push({ tag: m[1], open: m[0], inner: html.slice(m.index + m[0].length, end) });
  }
  return out;
}

/** The rows of `games-list` in order: [{ id, text, hrefs }] (text = visible text, hrefs = every link inside or on the row). */
export function listedGames(html) {
  const list = elementHtml(html, 'games-list');
  if (list == null) return [];
  return elementsOf(list, 'games-row').map((r) => ({
    id: /\bdata-game-id="([^"]*)"/.exec(r.open)?.[1] ?? null,
    text: pageText(r.inner).trim(),
    hrefs: [...(r.open + r.inner).matchAll(/\bhref="([^"]*)"/g)].map((x) => x[1]),
  }));
}

/** Whether the `games-list` area is in the HTML. */
export const hasGamesList = (html) => elementHtml(html, 'games-list') != null;

/** Parts of a game's details page: { text, moves, siteLinkHref }. */
export function gameDetails(html) {
  const details = elementHtml(html, 'game-details');
  const link = elementsOf(html, 'game-site-link')[0];
  return {
    text: details == null ? '' : pageText(details).trim(),
    moves: pageText(elementHtml(html, 'game-moves') ?? '').trim(),
    siteLinkHref: link ? /\bhref="([^"]*)"/.exec(link.open)?.[1] ?? null : null,
  };
}

/** Whether `text` holds `token` as a whole whitespace-separated word. */
export const hasToken = (text, token) => text.split(/[\s  ]+/).includes(token);

/** Date as the app must show it: Intl.DateTimeFormat(lang, { timeZone: 'UTC' }). */
export const formatDate = (epochSeconds, lang) =>
  new Intl.DateTimeFormat(lang, { timeZone: 'UTC' }).format(new Date(epochSeconds * 1000));

/** A number with one decimal as the page language shows it (Intl: `87.3` in en, `87,3` in fr). */
export const formatOneDecimal = (n, lang) =>
  new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

/**
 * Per row of `games-list` in order: { id, badges: [{ text, ariaLabel }] } for every element with
 * data-testid="<testid>" inside the row (text = visible text, ariaLabel = its aria-label or null).
 */
export function rowBadges(html, testid = 'games-analysed') {
  const list = elementHtml(html, 'games-list');
  if (list == null) return [];
  return elementsOf(list, 'games-row').map((r) => ({
    id: /\bdata-game-id="([^"]*)"/.exec(r.open)?.[1] ?? null,
    badges: elementsOf(r.inner, testid).map((b) => ({
      text: pageText(b.inner).trim(),
      ariaLabel: /\baria-label="([^"]*)"/.exec(b.open)?.[1] ?? null,
    })),
  }));
}

/** The end time (epoch seconds) of the fake's alpha_pawn month 0 game with this chess.com game number. */
export function fakeEndTime(gameNumber) {
  const { year, month } = utcMonth(0);
  return archiveGames('alpha_pawn', year, month).find((x) => x.url.endsWith(`/${gameNumber}`)).end_time;
}

// ---- browser ----
export const gameRows = (page) => page.locator('[data-testid="games-row"]');
export const gameRow = (page, id) => page.locator(`[data-testid="games-row"][data-game-id="${id}"]`);

/** { count, visible } of the rows of the list. */
export async function rowVisibility(page) {
  const rows = gameRows(page);
  const count = await rows.count();
  let visible = 0;
  for (let i = 0; i < count; i++) if (await rows.nth(i).isVisible()) visible++;
  return { count, visible };
}

// ---- Lichess / both sites ----
/** The rows of `html` whose text holds `token` as a whole word. */
export const rowsWith = (rows, token) => rows.filter((r) => hasToken(r.text, token));

/** The sites of the rows in order: 'Lichess' or 'chess.com'. */
export const rowSites = (rows) => rows.map((r) => (hasToken(r.text, 'Lichess') ? 'Lichess' : hasToken(r.text, 'chess.com') ? 'chess.com' : '?'));

/** The sites ('Lichess' / 'chess.com') of the fake's imported games (7 chess.com, 6 Lichess) by end time, newest first. */
export function expectedSiteOrder() {
  const chesscom = new Set(['100000001', '100000002', '100000003', '92000001', '92000002', '93000001', '93000002']);
  const all = [];
  for (const o of [0, -1, -2]) {
    const m = utcMonth(o);
    for (const g of archiveGames('alpha_pawn', m.year, m.month)) {
      if (chesscom.has(g.url.split('/').pop())) all.push({ site: 'chess.com', at: g.end_time * 1000 });
    }
  }
  for (const id of ['AbCdEf12', 'UltraB01x', 'Corresp1x', 'Drawn01x', 'StdFen01', 'UpperCs1']) all.push({ site: 'Lichess', at: lastMoveAtOf(id) });
  return all.sort((a, b) => b.at - a.at).map((g) => g.site);
}
