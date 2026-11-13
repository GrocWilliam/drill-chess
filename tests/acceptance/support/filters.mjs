// Domain layer for the games filters: the 13 fixture games (alpha_pawn + beta_rook), the filter form, a page's rows.
// No assertions of a criterion here: helpers return values, tests compare them.
import { hasToken, listedGames, openGames } from './games.mjs';
import { hasTestId, elementHtml, linkAccount } from './links.mjs';
import { pageText } from './accounts.mjs';
import { waitForImportEnd } from './imports.mjs';
import { signedUpUser } from './accounts.mjs';
import { archiveGames, utcMonth } from './fakes/chesscom-games.mjs';
import { lastMoveAtOf } from './fakes/lichess-games.mjs';

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);
const CHESSCOM_IDS = new Set(['100000001', '100000002', '100000003', '92000001', '92000002', '93000001', '93000002']);
const LABEL = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical', daily: 'Daily' };

// Lichess fixtures of beta_rook (support/fakes/lichess-games.mjs): colour and result are for the player.
const LICHESS = [
  { id: 'AbCdEf12', timeClass: 'blitz', colour: 'white', result: 'win' },
  { id: 'UltraB01x', timeClass: 'bullet', colour: 'black', result: 'win' },
  { id: 'Corresp1x', timeClass: 'daily', colour: 'white', result: 'win' },
  { id: 'Drawn01x', timeClass: 'rapid', colour: 'black', result: 'draw' },
  { id: 'StdFen01', timeClass: 'blitz', colour: 'white', result: 'win' },
  { id: 'UpperCs1', timeClass: 'rapid', colour: 'black', result: 'loss' },
];

/** The 13 imported fixture games, newest first: [{ site: 'chesscom'|'lichess', timeClass, colour, result, at, key, id? }]. */
export function fixtureGames() {
  const all = [];
  for (const o of [0, -1, -2]) {
    const m = utcMonth(o);
    for (const g of archiveGames('alpha_pawn', m.year, m.month)) {
      const num = g.url.split('/').pop();
      if (!CHESSCOM_IDS.has(num)) continue;
      const white = g.white.username.toLowerCase() === 'alpha_pawn';
      const mine = white ? g.white.result : g.black.result;
      const result = mine === 'win' ? 'win' : DRAWS.has(mine) ? 'draw' : 'loss';
      all.push({ site: 'chesscom', timeClass: g.time_class, colour: white ? 'white' : 'black', result, at: g.end_time * 1000, id: num });
    }
  }
  for (const l of LICHESS) all.push({ site: 'lichess', ...l, at: lastMoveAtOf(l.id) });
  all.sort((a, b) => b.at - a.at);
  return all.map((g) => ({ ...g, key: fingerprint(g) }));
}

const fingerprint = (g) => `${g.site}|${g.timeClass}|${g.colour}|${g.result}`;

/** A fingerprint (site|timeClass|colour|result) of a listed row, from its visible text. */
export function rowKey(text) {
  const site = hasToken(text, 'Lichess') ? 'lichess' : hasToken(text, 'chess.com') ? 'chesscom' : '?';
  const find = (map) => Object.entries(map).find(([, label]) => hasToken(text, label))?.[0] ?? '?';
  return [
    site,
    find(LABEL),
    find({ white: 'White', black: 'Black' }),
    find({ win: 'Win', draw: 'Draw', loss: 'Loss' }),
  ].join('|');
}

/** The fingerprints of the rows of a /games page, in order. */
export const listedKeys = (html) => listedGames(html).map((r) => rowKey(r.text));

/** Signs up a user and links alpha_pawn (chess.com) and beta_rook (Lichess), waiting for both imports → user. */
export async function userWithBothSites(env, opts = {}) {
  const u = await signedUpUser(env.app.url, opts);
  for (const [site, username] of [['chesscom', 'alpha_pawn'], ['lichess', 'beta_rook']]) {
    const r = await linkAccount(env.app.url, u.token, { site, username });
    if (r.status !== 303) throw new Error(`setup: linking ${site} failed (${r.status})`);
    const job = await waitForImportEnd(env.app.url, u.token, site, 20000);
    if (job?.status !== 'done') throw new Error(`setup: the ${site} import did not finish`);
  }
  return u;
}

/** GET /games?<query> signed in → { status, html, rows, keys }. */
export async function openFiltered(baseUrl, token, query, opts = {}) {
  const r = await openGames(baseUrl, token, { ...opts });
  if (!query) return { ...r, rows: listedGames(r.html), keys: listedKeys(r.html) };
  const { visitAs } = await import('./accounts.mjs');
  const f = await visitAs(baseUrl, token, { ...opts, path: `/games?${query}` });
  return { ...f, rows: listedGames(f.html), keys: listedKeys(f.html) };
}

/** The part of the HTML inside the games-filters form ('' when absent). */
export const filtersHtml = (html) => elementHtml(html, 'games-filters') ?? '';

/** What the filter form shows: { site, colour, result, time, opening } (selected option values, '' for blank). */
export function filterFormState(html) {
  const form = filtersHtml(html);
  const out = {};
  for (const name of ['site', 'colour', 'result', 'time']) {
    const sel = new RegExp(`<select\\b[^>]*\\bname="${name}"[^>]*>([\\s\\S]*?)</select>`).exec(form);
    if (!sel) { out[name] = null; continue; }
    const opts = sel[1].match(/<option\b[^>]*>/g) ?? [];
    const chosen = opts.find((o) => /\bselected\b/.test(o));
    out[name] = chosen ? (/\bvalue="([^"]*)"/.exec(chosen)?.[1] ?? '') : '';
  }
  const input = new RegExp(`<input\\b[^>]*\\bname="opening"[^>]*>`).exec(form)?.[0];
  out.opening = input ? (/\bvalue="([^"]*)"/.exec(input)?.[1] ?? '') : null;
  return out;
}

/** The visible text of the button/link `testid` inside the filter form ('' when absent). */
export const filterControlText = (html, testid) => pageText(elementHtml(filtersHtml(html), testid) ?? '').trim();

/** The href of the games-filter-reset link inside `games-none` (null when absent). */
export function noneResetHref(html) {
  const none = elementHtml(html, 'games-none');
  if (none == null) return null;
  const open = /<a\b[^>]*\bdata-testid="games-filter-reset"[^>]*>/.exec(none)?.[0];
  return open ? /\bhref="([^"]*)"/.exec(open)?.[1] ?? null : null;
}

/** The visible text of games-none ('' when absent). */
export const noneText = (html) => pageText(elementHtml(html, 'games-none') ?? '').trim();
export const hasNone = (html) => hasTestId(html, 'games-none');

// ---- browser ----
export const filtersForm = (page) => page.locator('[data-testid="games-filters"]');
export const pickFilter = (page, name, value) => filtersForm(page).locator(`select[name="${name}"]`).selectOption(value);
export const pressFilter = (page) => page.locator('[data-testid="games-filters"] [data-testid="games-filter-submit"]').click();
export const pressReset = (page) => page.locator('[data-testid="games-filters"] [data-testid="games-filter-reset"]').click();

/** Boxes of the controls of the filter form: [{ top, left, width, height }]. */
export const filterControlBoxes = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="games-filters"] select, [data-testid="games-filters"] input:not([type="hidden"]), [data-testid="games-filters"] button, [data-testid="games-filters"] a[href]')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ top: r.top + window.scrollY, left: r.left, width: r.width, height: r.height })),
  );

/** The number of distinct rows (tops within `tolerance` px) of boxes. */
export function rowCount(boxes, tolerance = 8) {
  const tops = [];
  for (const b of [...boxes].sort((a, b) => a.top - b.top)) if (!tops.some((t) => Math.abs(t - b.top) <= tolerance)) tops.push(b.top);
  return tops.length;
}
