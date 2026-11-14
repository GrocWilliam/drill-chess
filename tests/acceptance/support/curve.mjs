// Domain layer for the evaluation curve and the board page layouts (US-49). Actions and reads only: no assertions.
const tid = (page, id) => page.getByTestId(id);
const clean = (s) => (s ?? '').replace(/[\s  ]+/g, ' ').trim();

/** Records the script and stylesheet requests of the page (call before opening it) → live array of URLs. */
export function recordCodeRequests(page) {
  const urls = [];
  page.on('request', (r) => {
    if (['script', 'stylesheet'].includes(r.resourceType())) urls.push(r.url());
  });
  return urls;
}

/** The curve → { isSvg (it is, or holds, one <svg>), svgCount, targets: [data-ply], dots (circles of the svg) }. */
export async function curveFacts(page) {
  return tid(page, 'eval-curve').evaluate((el) => {
    const svgs = el.tagName.toLowerCase() === 'svg' ? [el] : [...el.querySelectorAll('svg')];
    const root = svgs[0];
    return {
      svgCount: svgs.length,
      isSvg: svgs.length > 0,
      targets: [...el.querySelectorAll('[data-testid="eval-curve-ply"]')].map((t) => Number(t.getAttribute('data-ply'))),
      dots: root ? root.querySelectorAll('circle').length : 0,
    };
  });
}

export const waitForCurve = (page) => tid(page, 'eval-curve').waitFor({ state: 'visible' });
export const clickCurvePly = (page, ply) =>
  tid(page, 'eval-curve').locator(`[data-testid="eval-curve-ply"][data-ply="${ply}"]`).click();

/** Number of moves of the list whose aria-label ends with a mark. */
export async function markedMoveCount(page) {
  return tid(page, 'move-list').locator('[data-testid="move"]').evaluateAll(
    (els) => els.filter((e) => /, (inaccuracy|mistake|blunder)$/.test(e.getAttribute('aria-label') ?? '')).length,
  );
}

/** The mark word of each move of the list → Map ply → '' | 'inaccuracy' | 'mistake' | 'blunder' (from aria-label). */
export async function moveMarkWords(page) {
  const all = await tid(page, 'move-list').locator('[data-testid="move"]').evaluateAll((els) =>
    els.map((e) => [Number(e.getAttribute('data-ply')), e.getAttribute('aria-label') ?? '']),
  );
  return new Map(all.map(([ply, label]) => [ply, /, (inaccuracy|mistake|blunder)$/.exec(label)?.[1] ?? '']));
}

const evalDetails = (page) =>
  page.locator('details').filter({ has: page.locator('summary', { hasText: /Evaluation table|Tableau des évaluations/ }) });

export const openEvalTable = async (page) => {
  const d = evalDetails(page);
  await d.locator('summary').click();
  await d.locator('table').waitFor({ state: 'visible' });
};

/** The details of the curve → { summary, headers, rows: [{ text, cells }] }. */
export async function evalTable(page) {
  const d = evalDetails(page);
  return {
    summary: clean(await d.locator('summary').innerText()),
    headers: (await d.locator('th').allInnerTexts()).map(clean),
    rows: await d.locator('tr').evaluateAll((trs) =>
      trs
        .filter((tr) => tr.querySelector('td'))
        .map((tr) => ({
          text: tr.textContent.replace(/[\s  ]+/g, ' ').trim(),
          cells: [...tr.querySelectorAll('td, th')].map((c) => c.textContent.replace(/[\s  ]+/g, ' ').trim()),
        })),
    ),
  };
}

/** Boxes of the layout → { bar, board, panel } (panel = the ancestor of move-list that is a sibling of the board's), plus scroll. */
export async function layout(page) {
  return page.evaluate(() => {
    const q = (id) => document.querySelector(`[data-testid="${id}"]`);
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const board = q('board');
    let panel = q('move-list');
    while (panel && panel.parentElement && !panel.parentElement.contains(board)) panel = panel.parentElement;
    const se = document.scrollingElement;
    return {
      bar: box(q('eval-bar')),
      board: box(board),
      panel: box(panel),
      scrollWidth: se.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
}

/** Buttons and links of the page under 44×44 (1px tolerance), ignoring the curve's own svg targets. */
export async function undersizedControls(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button, [role="button"]')) {
      if (el.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
      if (r.width < 43 || r.height < 43) {
        out.push({ label: (el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent).trim(), width: r.width, height: r.height });
      }
    }
    return out;
  });
}
