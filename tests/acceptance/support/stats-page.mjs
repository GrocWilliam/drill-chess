// Domain layer for the /stats page (US-70): HTTP reads of the server-rendered page, browser reads.
// No assertions of a criterion here: helpers return values, tests compare them.
import { pageText, visitAs } from './accounts.mjs';
import { elementHtml, hasTestId, linkAccount } from './links.mjs';
import { signedUpUser } from './accounts.mjs';
import { waitForImportEnd } from './imports.mjs';

/** GET /stats?<query> signed in (token null = visitor) → { status, location, html }. */
export const openStats = (baseUrl, token, query = '', opts = {}) =>
  visitAs(baseUrl, token, { ...opts, path: `/stats${query ? `?${query}` : ''}` });

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
    out.push({ open: m[0], inner: html.slice(m.index + m[0].length, end) });
  }
  return out;
}

/** A row's numbers: the integers before the score (result bar removed), then the score `NN%`. */
function rowFigures(row, strip = null) {
  let inner = row.inner;
  for (const bar of elementsOf(inner, 'result-bar')) inner = inner.replace(bar.open + bar.inner, ' ');
  let text = pageText(inner).trim();
  if (strip) text = text.replace(strip, ' ');
  const score = /(\d+)\s*%/.exec(text);
  const nums = (score ? text.replace(score[0], ' ') : text).match(/\d+/g)?.map(Number) ?? [];
  return { text, games: nums[0], wins: nums[1], draws: nums[2], losses: nums[3], score: score ? Number(score[1]) : null, scoreText: score?.[0] ?? null };
}

const hrefsOf = (row) => [...(row.open + row.inner).matchAll(/\bhref="([^"]*)"/g)].map((x) => x[1].replaceAll('&amp;', '&'));

/** The colour rows: [{ colour, text, games, wins, draws, losses, score }]. */
export const colourRows = (html) =>
  elementsOf(elementHtml(html, 'stats-colour') ?? '', 'stats-colour-row').map((r) => ({
    colour: /\bdata-colour="([^"]*)"/.exec(r.open)?.[1] ?? null, ...rowFigures(r),
  }));

/** The time-control rows in order: [{ time, hrefs, text, games, wins, draws, losses, score }]. */
export const timeRows = (html) =>
  elementsOf(elementHtml(html, 'stats-time') ?? '', 'stats-time-row').map((r) => ({
    time: /\bdata-time="([^"]*)"/.exec(r.open)?.[1] ?? null, hrefs: hrefsOf(r), ...rowFigures(r),
  }));

/** The visible text of a block ('' when absent). */
export const blockText = (html, testid) => pageText(elementHtml(html, testid) ?? '').trim();
export const hasBlock = (html, testid) => hasTestId(html, testid);

/** The empty state: { text, hrefs } or null. */
export function emptyState(html) {
  const e = elementsOf(html, 'stats-empty')[0];
  return e ? { text: pageText(e.inner).trim(), hrefs: hrefsOf(e) } : null;
}

/** The selected value of each select of the filters form (null when the select is absent). */
export function filterValues(html) {
  const form = elementHtml(html, 'stats-filters') ?? '';
  const out = {};
  for (const name of ['site', 'time', 'period']) {
    const sel = new RegExp(`<select\\b[^>]*\\bname="${name}"[^>]*>([\\s\\S]*?)</select>`).exec(form);
    if (!sel) { out[name] = null; continue; }
    const chosen = (sel[1].match(/<option\b[^>]*>/g) ?? []).find((o) => /\bselected\b/.test(o));
    out[name] = chosen ? (/\bvalue="([^"]*)"/.exec(chosen)?.[1] ?? '') : '';
  }
  return out;
}

/** Same figures as an /api/stats row. */
export const figuresOf = (r) => ({ games: r.games, wins: r.wins, draws: r.draws, losses: r.losses, score: r.score });

// ---- browser ----
/** Ids (data-testid) of the visible nav links of `container` ('nav-tabs' or 'banner'), in document order. */
export const visibleNavIds = (page, container) =>
  page.evaluate((c) => {
    const root = c === 'banner' ? document.querySelector('header, [role="banner"]') : document.querySelector(`[data-testid="${c}"]`);
    return [...(root?.querySelectorAll('[data-testid^="nav-"]') ?? [])]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })
      .map((el) => el.getAttribute('data-testid'));
  }, container);

export const navLink = (page, container, id) =>
  (container === 'banner' ? page.getByRole('banner').first() : page.getByTestId(container)).getByTestId(id);

/** The visible text of every result bar on the page, with the row's data-colour/data-time. */
export const resultBars = (page) =>
  page.evaluate(() => [...document.querySelectorAll('[data-testid="result-bar"]')].map((el) => el.innerText));

export const pickStatsFilter = (page, name, value) =>
  page.locator('[data-testid="stats-filters"]').locator(`select[name="${name}"]`).selectOption(value);
export const pressStatsFilter = (page) => page.locator('[data-testid="stats-filters"] [data-testid="stats-filter-submit"]').click();

// ---- mistakes-by-phase block (US-73) ----
const DECIMAL = /\d+[.,]\d/g;

/** A number written as the page language shows it: one decimal, `,` in French, `.` in English. */
export const oneDecimal = (n, lang = 'en') =>
  n.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });

/** The phase rows of the mistakes block: [{ phase, text, values: [inaccuracy, mistake, blunder] as written }]. */
export const mistakePhaseRows = (html) =>
  elementsOf(html, 'stats-mistakes-phase').map((r) => {
    const text = pageText(r.inner).trim();
    return { phase: /\bdata-phase="([^"]*)"/.exec(r.open)?.[1] ?? null, text, values: text.match(DECIMAL) ?? [] };
  });

/** The text of `stats-mistakes-games` ('' when absent). */
export const mistakesGamesText = (html) => blockText(html, 'stats-mistakes-games');

/** The accuracy as written in `stats-mistakes-accuracy`: the number before `%` ('' when absent). */
export const mistakesAccuracyText = (html) =>
  /(\d+[.,]\d)\s*%/.exec(blockText(html, 'stats-mistakes-accuracy'))?.[1] ?? '';

/** The empty state of the mistakes block: { text, hrefs } or null. */
export function mistakesEmpty(html) {
  const e = elementsOf(html, 'stats-mistakes-empty')[0];
  return e ? { text: pageText(e.inner).trim(), hrefs: hrefsOf(e) } : null;
}

/** Position of a block in the HTML (-1 when absent). */
export const blockPosition = (html, testid) => html.search(new RegExp(`data-testid="${testid}"`));

// browser
/** The phase rows visible on the page → [{ phase, text }]. */
export const visibleMistakeRows = (page) =>
  page.evaluate(() => [...document.querySelectorAll('[data-testid="stats-mistakes-phase"]')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })
    .map((el) => ({ phase: el.getAttribute('data-phase'), text: el.innerText.replace(/[\s  ]+/g, ' ').trim() })));

/** The visible text of the mistakes block. */
export const mistakesBlockText = (page) =>
  page.getByTestId('stats-mistakes').evaluate((el) => el.innerText.replace(/[\s  ]+/g, ' ').trim());
// ---- openings block (US-71) ----
const ECO_RE = /\b[A-E]\d{2}\b/;

/**
 * The rows of the openings block: [{ text, eco, hrefs, games, wins, draws, losses, score, scoreText }].
 * `eco` is the first A00-E99 token of the row text (null when none); it is removed before the figures are read.
 */
export const openingRows = (html) =>
  elementsOf(elementHtml(html, 'stats-openings') ?? '', 'stats-opening-row').map((r) => {
    const text = pageText(r.inner).trim();
    const eco = ECO_RE.exec(text)?.[0] ?? null;
    const figures = rowFigures(r, eco);
    return { ...figures, text, eco, hrefs: hrefsOf(r) };
  });

/** An href as { path, params } with params a sorted [name, value] list (order of the query does not matter). */
export function hrefParts(href) {
  const u = new URL(href, 'http://app.test');
  return { path: u.pathname, params: [...u.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) };
}

/** The /games link of an opening row as { path, params } (null when it has no link to /games). */
export function openingLink(row) {
  const href = row.hrefs.find((h) => h.split('?')[0] === '/games');
  return href ? hrefParts(href) : null;
}

const openingsColourControl = (page) => page.locator('[data-testid="stats-filters"] [data-testid="stats-openings-colour"]');

/** Picks Both/White/Black ('both'|'white'|'black') in the openings toggle, whether it is a radio group or a select. */
export async function pickOpeningsColour(page, value) {
  const control = openingsColourControl(page);
  const radio = control.locator(`input[type="radio"][value="${value}"]`);
  if (await radio.count()) await radio.check();
  else await control.selectOption(value);
}

/** Signs up a user and links the chess.com player `opening_owl` (18 games, 13 opening groups) → user. */
export async function userWithManyOpenings(env, opts = {}) {
  const u = await signedUpUser(env.app.url, opts);
  const r = await linkAccount(env.app.url, u.token, { site: 'chesscom', username: 'opening_owl' });
  if (r.status !== 303) throw new Error(`setup: linking failed (${r.status})`);
  if ((await waitForImportEnd(env.app.url, u.token, 'chesscom', 20000))?.status !== 'done') throw new Error('setup: import did not finish');
  return u;
}
