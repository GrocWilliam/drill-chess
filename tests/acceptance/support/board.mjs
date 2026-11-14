// Browser domain layer for the shared board (`Board.svelte`) on the demo page. Actions and reads only.

/** Opens /games/demo and waits until the board is live (chessground has drawn its pieces). */
export async function openDemo(page, baseUrl) {
  await page.goto(baseUrl + '/games/demo', { waitUntil: 'networkidle' });
  await page.getByTestId('board').locator('piece').first().waitFor({ state: 'attached' });
}

const boardEl = (page) => page.getByTestId('board');
const input = (page) => page.getByTestId('board-move-input');
const invalid = (page) => page.getByTestId('board-move-invalid');
const chooser = (page) => page.getByTestId('board-promotion');

export const boardFen = (page) => boardEl(page).getAttribute('data-fen');
export const boardOrientation = (page) => boardEl(page).getAttribute('data-orientation');
/** The first field of the FEN shown (piece placement), split by rank: index 0 is the 8th rank. */
export const boardRanks = async (page) => (await boardFen(page)).split(' ')[0].split('/');

/** Waits (≤ ms) until the shown FEN differs from `before`, or the invalid message or the promotion chooser shows. */
async function settle(page, before, ms = 1000) {
  await page
    .waitForFunction(
      (prev) => {
        const b = document.querySelector('[data-testid="board"]');
        const shown = (id) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          return !!el && el.getClientRects().length > 0;
        };
        return b?.getAttribute('data-fen') !== prev || shown('board-move-invalid') || shown('board-promotion');
      },
      before,
      { timeout: ms },
    )
    .catch(() => {});
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** The centre of `square` (e.g. 'e2') in page coordinates, from the board's box and orientation. */
async function squareCentre(page, square) {
  const board = boardEl(page);
  await board.scrollIntoViewIfNeeded();
  const inner = board.locator('cg-board');
  const box = (await inner.count()) ? await inner.first().boundingBox() : await board.boundingBox();
  const size = box.width / 8;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const white = (await boardOrientation(page)) !== 'black';
  const col = white ? file : 7 - file;
  const row = white ? 7 - rank : rank;
  return { x: box.x + (col + 0.5) * size, y: box.y + (row + 0.5) * (box.height / 8) };
}

/** Drags the piece on `from` to `to` with the mouse. */
export async function dragPiece(page, from, to) {
  const before = await boardFen(page);
  const a = await squareCentre(page, from);
  const b = await squareCentre(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await settle(page, before);
}

/** Clicks `square`. */
export async function clickSquare(page, square) {
  const before = await boardFen(page);
  const p = await squareCentre(page, square);
  await page.mouse.click(p.x, p.y);
  await settle(page, before, 300);
}

/** Types `move` in the move field and presses Enter. */
export async function typeMove(page, move) {
  const before = await boardFen(page);
  await input(page).fill(move);
  await input(page).press('Enter');
  await settle(page, before);
}

/** Types each move in turn. */
export async function typeMoves(page, moves) {
  for (const m of moves) await typeMove(page, m);
}

export const moveFieldValue = (page) => input(page).inputValue();

/** The label of the move field (its <label>, aria-labelledby or aria-label). */
export async function moveFieldLabel(page) {
  return input(page).evaluate((el) => {
    const byId = el.getAttribute('aria-labelledby');
    const t = el.labels?.[0]?.textContent ?? (byId ? document.getElementById(byId)?.textContent : null) ?? el.getAttribute('aria-label') ?? '';
    return t.replace(/\s+/g, ' ').trim();
  });
}

/** Whether `board-move-invalid` is shown. */
export const invalidMoveShown = async (page) => (await invalid(page).count()) > 0 && invalid(page).isVisible();
export const invalidMoveText = async (page) => (await invalid(page).innerText()).replace(/\s+/g, ' ').trim();
/** Boxes of the move field and of the invalid message → { field, message }. */
export const moveFieldAndMessageBoxes = async (page) => ({
  field: await input(page).boundingBox(),
  message: await invalid(page).boundingBox(),
});

/** Whether the promotion chooser is shown. */
export const promotionChooserShown = async (page) => (await chooser(page).count()) > 0 && chooser(page).isVisible();
/** Which of the buttons q, r, b, n of the chooser are visible → e.g. ['q', 'r', 'b', 'n']. */
export async function promotionChoices(page) {
  const out = [];
  for (const p of ['q', 'r', 'b', 'n']) if (await chooser(page).getByTestId(`board-promotion-${p}`).isVisible()) out.push(p);
  return out;
}
/** Picks a piece in the chooser ('q' | 'r' | 'b' | 'n'). */
export async function choosePromotion(page, piece) {
  const before = await boardFen(page);
  await chooser(page).getByTestId(`board-promotion-${piece}`).click();
  await settle(page, before);
}
/** Presses Escape (with the chooser open). */
export async function pressEscape(page) {
  const before = await boardFen(page);
  await page.keyboard.press('Escape');
  await settle(page, before);
}
