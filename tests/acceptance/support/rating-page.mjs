// Domain layer for the /stats rating block (US-72): users with rating series (fake players `rating_rook`,
// `rating_bishop`, `rating_pawn`, see fakes/chesscom-games.mjs and fakes/lichess-games.mjs), reads of the block.
// No assertions of a criterion here: helpers return values, tests compare them.
import { pageText, signedUpUser } from './accounts.mjs';
import { waitForImportEnd } from './imports.mjs';
import { elementHtml, hasTestId, linkAccount } from './links.mjs';
import { requestStats } from './stats.mjs';

/** Signs up and links each `{ site, username }`, waiting for the imports → user. */
export async function userWithLinks(env, links, opts = {}) {
  const u = await signedUpUser(env.app.url, opts);
  for (const { site, username } of links) {
    const r = await linkAccount(env.app.url, u.token, { site, username });
    if (r.status !== 303) throw new Error(`setup: linking ${site} failed (${r.status})`);
    const job = await waitForImportEnd(env.app.url, u.token, site, 20000);
    if (job?.status !== 'done') throw new Error(`setup: the ${site} import did not finish`);
  }
  return u;
}

/** chesscom-blitz with 5 games (ratings 1510, 1580, 1490, 1560, 1530) and lichess-rapid with 2 (1600, 1625). */
export const userWithTwoSeries = (env) =>
  userWithLinks(env, [{ site: 'chesscom', username: 'rating_rook' }, { site: 'lichess', username: 'rating_rook' }]);
/** chesscom-blitz only, with the ratings 1500, 1560, 1480, 1540 in date order. */
export const userWithFourGames = (env, opts) => userWithLinks(env, [{ site: 'chesscom', username: 'rating_bishop' }], opts);
/** chesscom-blitz only, with one game. */
export const userWithOneGame = (env, opts) => userWithLinks(env, [{ site: 'chesscom', username: 'rating_pawn' }], opts);

/** The ratings (date order) of the series `key` (`<site>-<time>`) of GET /api/stats. */
export async function apiRatings(baseUrl, token, key) {
  const r = await requestStats(baseUrl, token);
  const s = r.body?.rating?.series?.find((x) => `${x.site}-${x.time}` === key);
  return s ? s.points.map((p) => p.rating) : null;
}

/** The series picker of the page: { inFilters (select is inside the stats-filters form), name, options: [{ value, label }], selected }. */
export function seriesPicker(html) {
  const open = /<select\b[^>]*\bdata-testid="stats-rating-series"[^>]*>/.exec(html);
  if (!open) return null;
  const end = html.indexOf('</select>', open.index);
  const inner = html.slice(open.index + open[0].length, end);
  const options = [...inner.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map((m) => ({
    value: /\bvalue="([^"]*)"/.exec(m[1])?.[1] ?? '',
    label: pageText(m[2]).trim(),
    selected: /\bselected\b/.test(m[1]),
  }));
  const form = elementHtml(html, 'stats-filters') ?? '';
  return {
    inFilters: form.includes('data-testid="stats-rating-series"'),
    name: /\bname="([^"]*)"/.exec(open[0])?.[1] ?? null,
    options: options.map(({ value, label }) => ({ value, label })),
    selected: options.find((o) => o.selected)?.value ?? null,
  };
}

const block = (html, id) => elementHtml(html, id) ?? '';
export const hasRatingPart = (html, id) => hasTestId(html, id);
export const ratingText = (html, id) => pageText(block(html, id)).trim();

/** The first heading of the rating block ('' when none). */
export const ratingHeading = (html) => pageText(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/.exec(block(html, 'stats-rating'))?.[1] ?? '').trim();

/** The number after each label in the summary: { first, last, highest, lowest } with the labels of `labels` (null when absent). */
export function ratingSummary(html, labels) {
  const text = ratingText(html, 'stats-rating-summary');
  const out = {};
  for (const [key, label] of Object.entries(labels)) {
    const m = new RegExp(`${label}\\D{0,6}(\\d+)`).exec(text);
    out[key] = m ? Number(m[1]) : null;
  }
  return out;
}

export const EN = { first: 'First', last: 'Last', highest: 'Highest', lowest: 'Lowest' };
export const FR = { first: 'Première', last: 'Dernière', highest: 'Plus haute', lowest: 'Plus basse' };

/** The ratings listed by the table alternative of the chart, in order (last cell of each body row). */
export function tableRatings(html) {
  const section = block(html, 'stats-rating-chart') || block(html, 'stats-rating');
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/.exec(section)?.[1] ?? section.replace(/<thead\b[\s\S]*?<\/thead>/, '');
  return [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => {
    const cells = [...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => pageText(c[1]).trim());
    return Number(cells[cells.length - 1]);
  });
}

/** Whether the chart block holds an inline <svg> and a <details> with a table. */
export function chartFacts(html) {
  const c = block(html, 'stats-rating-chart');
  return { svg: /<svg\b/.test(c), details: /<details\b/.test(c) && /<table\b/.test(c) };
}

// ---- browser ----
export const pickSeries = (page, value) =>
  page.locator('[data-testid="stats-filters"]').locator('select[name="series"]').selectOption(value);
export const pressFilters = (page) => page.locator('[data-testid="stats-filters"] [data-testid="stats-filter-submit"]').click();
export const chartBox = (page) => page.getByTestId('stats-rating-chart').boundingBox();
export const chartVisible = (page) => page.getByTestId('stats-rating-chart').isVisible();
