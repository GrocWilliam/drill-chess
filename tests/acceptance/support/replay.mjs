// Domain layer for the game replay on /games/demo (GameReview, MoveList). Actions and reads only: no assertions.
import { openDemo } from './board.mjs';
import { visit } from './visitor.mjs';

const tid = (page, id) => page.getByTestId(id);
const list = (page) => tid(page, 'move-list');
const moveAt = (page, ply) => list(page).locator(`[data-testid="move"][data-ply="${ply}"]`);

/** Opens /games/demo (optionally with ?ply=N) and waits until the board is live. */
export async function openReplay(page, baseUrl, ply) {
  if (ply === undefined) return openDemo(page, baseUrl);
  await page.goto(`${baseUrl}/games/demo?ply=${ply}`, { waitUntil: 'networkidle' });
  await tid(page, 'board').locator('piece').first().waitFor({ state: 'attached' });
}

/** Sets a marker on window, to tell later whether the page was reloaded. */
export const markWindow = (page) => page.evaluate(() => { window.__replayMarker = 'still-here'; });
export const windowMarker = (page) => page.evaluate(() => window.__replayMarker ?? null);

/** Waits until the URL search is `search` (e.g. '?ply=3'). */
export const waitForSearch = (page, search) =>
  page.waitForFunction((s) => location.search === s, search);
export const urlSearch = (page) => page.evaluate(() => location.search);

export const clickControl = (page, name) => tid(page, `review-${name}`).click(); // start | prev | next | end | flip
export const clickMove = (page, ply) => moveAt(page, ply).click();
export const pressKey = (page, key) => page.keyboard.press(key);
export const focusMoveField = (page) => tid(page, 'board-move-input').focus();
export const typeInMoveField = (page, text) => tid(page, 'board-move-input').pressSequentially(text);
export const clickBackToGame = (page) => tid(page, 'review-back-to-game').click();

/** Moves of the list → [{ ply, text, label, current }] in document order. */
export async function moves(page) {
  return list(page).locator('[data-testid="move"]').evaluateAll((els) =>
    els.map((e) => ({
      ply: Number(e.getAttribute('data-ply')),
      text: e.textContent.trim(),
      label: e.getAttribute('aria-label'),
      current: e.hasAttribute('aria-current'),
      currentValue: e.getAttribute('aria-current'),
    })),
  );
}
export const moveListItems = (page) => list(page).locator('li').count();
/** The ply of the current move, or null. */
export async function currentPly(page) {
  const cur = (await moves(page)).filter((m) => m.current);
  return cur.length ? cur[0].ply : null;
}
export const currentMoveCount = async (page) => (await moves(page)).filter((m) => m.current).length;

export const backToGameShown = async (page) => (await tid(page, 'review-back-to-game').count()) > 0 && tid(page, 'review-back-to-game').isVisible();
export const controlLabel = (page, name) => tid(page, `review-${name}`).getAttribute('aria-label');
export const controlBox = (page, name) => tid(page, `review-${name}`).boundingBox();

/** GET /games/demo?ply=<raw> over HTTP → { status, html, currentPly } (currentPly from aria-current in the HTML, or null). */
export async function readDemoHtml(baseUrl, raw) {
  const r = await visit(baseUrl, { path: `/games/demo?ply=${raw}` });
  const cur = [];
  for (const m of r.html.matchAll(/<button\b([^>]*)>/g)) {
    const a = m[1];
    if (/data-testid="move"/.test(a) && /aria-current="true"/.test(a)) cur.push(Number(/data-ply="(\d+)"/.exec(a)?.[1]));
  }
  return { status: r.status, html: r.html, currentPly: cur.length ? cur[0] : null };
}
