// Domain layer for the repertoire editor /openings/<colour> (US-88): HTTP reads of the server-rendered page and
// browser actions on it. Actions and reads only: no assertion of a criterion here.
import { pageText, visitAs } from './accounts.mjs';
import { newVisitorPage } from './pages.mjs';
import { savePreferences } from './preferences.mjs';
import { boardFen, typeMove } from './board.mjs';

export { typeMove };

/** Opens the editor over HTTP as `user` → { status, location, html }. `line` is a UCI list (array or string). */
export async function editorHtml(baseUrl, user, colour, { line, lang } = {}) {
  // A signed-in user's stored language wins over the cookie: store it first.
  if (lang && user?.token) await savePreferences(baseUrl, user.token, { lang, theme: 'system' });
  const l = Array.isArray(line) ? line.join(',') : line;
  const path = `/openings/${colour}` + (l === undefined ? '' : `?line=${l}`);
  return visitAs(baseUrl, user?.token ?? '', { path, cookies: lang ? { lang } : {} });
}

/** GET /openings/<colour> without a session → { status, location, html }. */
export async function editorAsVisitor(baseUrl, colour) {
  const r = await fetch(`${baseUrl}/openings/${colour}`, { redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location'), html: await r.text() };
}

/** Every element with this data-testid in HTML → [{ open (the opening tag), inner (its inner HTML) }]. */
export function allElements(html, testid) {
  const out = [];
  const openRe = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\bdata-testid="${testid}"[^>]*>`, 'g');
  for (let o; (o = openRe.exec(html)); ) {
    const tag = o[1];
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
    re.lastIndex = o.index + o[0].length;
    let depth = 1;
    let end = html.length;
    for (let m; (m = re.exec(html)); ) {
      depth += m[1] ? -1 : /\/>$/.test(m[0]) ? 0 : 1;
      if (depth === 0) { end = m.index; break; }
    }
    out.push({ open: o[0], inner: html.slice(o.index + o[0].length, end) });
  }
  return out;
}

export const attr = (open, name) => {
  const v = new RegExp(`\\b${name}="([^"]*)"`).exec(open)?.[1];
  return v === undefined ? null : v.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
};
export const text = (inner) => pageText(inner).replace(/\s+/g, ' ').trim();

/** The `data-fen` / `data-orientation` of the board of server-rendered HTML. */
export function boardOf(html) {
  const b = allElements(html, 'board')[0];
  return b ? { fen: attr(b.open, 'data-fen'), orientation: attr(b.open, 'data-orientation') } : null;
}

/** The first four fields of a FEN (position, turn, castling, en passant): the counters are left out. */
export const positionOf = (fen) => fen.split(' ').slice(0, 4).join(' ');

export const nameOf = (html) => {
  const e = allElements(html, 'opening-name')[0];
  return e ? text(e.inner) : null;
};
export const emptyShown = (html) => allElements(html, 'opening-moves-empty').length > 0;

/** The path moves of the page → [{ text, line (the `line` of its link, '' when none) }]. */
export function pathMoves(html) {
  return allElements(html, 'opening-path-move').map((e) => ({ text: text(e.inner), line: lineOf(attr(e.open, 'href')) }));
}
/** The `line` of the link of `opening-path-start`. */
export const pathStartLine = (html) => {
  const e = allElements(html, 'opening-path-start')[0];
  return e ? lineOf(attr(e.open, 'href')) : null;
};

/** The repertoire moves listed → [{ text, uci, by, line }]. */
export function listedMoves(html) {
  return allElements(html, 'opening-move').map((e) => ({
    text: text(e.inner), uci: attr(e.open, 'data-uci'), by: attr(e.open, 'data-by'), line: lineOf(attr(e.open, 'href')),
  }));
}

/** The `line` query of a link href ('' when none). */
function lineOf(href) {
  if (href == null) return null;
  return new URL(href, 'http://x').searchParams.get('line') ?? '';
}

// ---- browser ----

/** A signed-in page of `user`. opts: { lang, viewport } */
export async function editorPage(browser, baseUrl, user, { lang, viewport } = {}) {
  if (lang) await savePreferences(baseUrl, user.token, { lang, theme: 'system' });
  return newVisitorPage(browser, {
    baseUrl, session: user.token, lang, viewport, acceptLanguage: lang === 'fr' ? 'fr-FR' : 'en-US',
  });
}

/** Opens the editor and waits until its board is live. */
export async function openEditor(page, baseUrl, colour, line) {
  await page.goto(`${baseUrl}/openings/${colour}` + (line ? `?line=${line}` : ''), { waitUntil: 'networkidle' });
  await page.getByTestId('board').locator('piece').first().waitFor({ state: 'attached' });
}

/** The `line` query of the current URL ('' when none) and its path. */
export const currentLine = (page) => new URL(page.url()).searchParams.get('line') ?? '';
export const currentPath = (page) => new URL(page.url()).pathname;

/** Waits until the URL holds this line. */
export const waitForLine = (page, line) => page.waitForFunction((l) => (new URL(location.href).searchParams.get('line') ?? '') === l, line);

/** The shown path: [text of each opening-path-move]. */
export const shownPath = (page) => page.getByTestId('opening-path').getByTestId('opening-path-move').allInnerTexts().then((a) => a.map((t) => t.trim()));
export const shownName = async (page) => (await page.getByTestId('opening-name').innerText()).replace(/\s+/g, ' ').trim();

/** The listed repertoire moves → [{ uci, by, text }]. */
export function shownMoves(page) {
  return page.getByTestId('opening-moves').getByTestId('opening-move').evaluateAll((els) =>
    els.map((e) => ({ uci: e.getAttribute('data-uci'), by: e.getAttribute('data-by'), text: e.textContent.replace(/\s+/g, ' ').trim() })),
  );
}

export const errorText = async (page) => {
  const e = page.getByTestId('opening-error');
  await e.waitFor({ state: 'visible' });
  return { text: (await e.innerText()).replace(/\s+/g, ' ').trim(), role: await e.getAttribute('role') };
};

/** Follows the path link at `index` (0-based among opening-path-move). */
export const followPathMove = (page, index) => page.getByTestId('opening-path').getByTestId('opening-path-move').nth(index).click();

/** The board position shown (first four FEN fields). */
export const shownPosition = async (page) => positionOf(await boardFen(page));

/** Layout: boxes of the board and of the panel (the widest ancestor of `opening-name` not holding the board). */
export function boardAndPanelBoxes(page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="board"]');
    let panel = document.querySelector('[data-testid="opening-name"]');
    while (panel.parentElement && !panel.parentElement.contains(board)) panel = panel.parentElement;
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    return { board: r(board), panel: r(panel) };
  });
}

// ---- US-90: the delete modal ----

/** The editor over HTTP with the delete modal of `moveId` open → { status, location, html }. */
export async function deleteModalHtml(baseUrl, user, colour, line, moveId, { lang } = {}) {
  if (lang && user?.token) await savePreferences(baseUrl, user.token, { lang, theme: 'system' });
  const l = Array.isArray(line) ? line.join(',') : line;
  return visitAs(baseUrl, user.token, {
    path: `/openings/${colour}?line=${l}&modal=opening-delete&move=${moveId}`, cookies: lang ? { lang } : {},
  });
}

/** The text of `modal-opening-delete` in server-rendered HTML and whether it is an open <dialog> → { open, text } or null. */
export function deleteModalOf(html) {
  const e = allElements(html, 'modal-opening-delete')[0];
  if (!e) return null;
  return { open: /^<dialog\b/i.test(e.open) && /\sopen(\s|=|>|\/)/i.test(e.open), text: text(e.inner) };
}

/** The `opening-delete` links of the listed moves → [{ uci, href }] (the link sits inside its `opening-move`). */
export function deleteLinks(html) {
  return allElements(html, 'opening-move').map((m) => {
    const l = allElements(m.inner, 'opening-delete')[0];
    return { uci: attr(m.open, 'data-uci'), href: l ? attr(l.open, 'href') : null };
  });
}

/** Presses opening-delete of the listed move `uci`. */
export const pressDelete = (page, uci) =>
  page.getByTestId('opening-moves').locator(`[data-testid="opening-move"][data-uci="${uci}"]`).getByTestId('opening-delete').click();
export const deleteModal = (page) => page.getByTestId('modal-opening-delete');
export const confirmDelete = (page) => page.getByTestId('opening-delete-confirm').click();
export const cancelDelete = (page) => page.getByTestId('opening-delete-cancel').click();
export const modalText = async (page) => (await deleteModal(page).innerText()).replace(/\s+/g, ' ').trim();
export const currentSearch = (page) => new URL(page.url()).searchParams;

/** Visible links and buttons inside the delete modal → [{ testid, width, height }]. */
export const modalTargets = (page) =>
  deleteModal(page).evaluate((d) =>
    [...d.querySelectorAll('a[href], button')].map((el) => {
      const r = el.getBoundingClientRect();
      return { testid: el.getAttribute('data-testid'), width: r.width, height: r.height };
    }),
  );
