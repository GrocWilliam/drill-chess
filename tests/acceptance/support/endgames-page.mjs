// Domain layer for the endgames list /endgames (US-109): HTTP reads of the server-rendered page and browser
// actions on it. Reads and actions only: no assertion of a criterion here.
import { visitAs } from './accounts.mjs';
import { visit } from './visitor.mjs';
import { allElements, attr, text } from './repertoire-page.mjs';
import { newVisitorPage } from './pages.mjs';
import { savePreferences } from './preferences.mjs';

/** GET /endgames as a visitor without a session → { status, location, html }. */
export const endgamesAsVisitor = (baseUrl) => visit(baseUrl, { path: '/endgames' });

/** GET /endgames signed in (optionally in `lang`, stored in the preferences) → { status, location, html }. */
export async function endgamesHtml(baseUrl, token, { lang } = {}) {
  if (lang) await savePreferences(baseUrl, token, { lang, theme: 'system' });
  return visitAs(baseUrl, token, { path: '/endgames', cookies: lang ? { lang } : {} });
}

/** The level sections: [{ level, text (all visible text), count (text of the count), cards: [card] }]. */
export function levelsOf(html) {
  const out = [];
  for (const n of [1, 2, 3, 4]) {
    const e = allElements(html, `endgames-level-${n}`)[0];
    if (!e) continue;
    out.push({
      level: n,
      text: text(e.inner),
      count: allElements(e.inner, 'endgames-level-count')[0] ? text(allElements(e.inner, 'endgames-level-count')[0].inner) : null,
      cards: allElements(e.inner, 'endgame-card').map(cardOf),
    });
  }
  return out;
}

/** One card element → { id, href, text, mastered (badge text or null), streak, attempts }. */
function cardOf(e) {
  const field = (id) => { const f = allElements(e.inner, id)[0]; return f ? text(f.inner) : null; };
  return {
    id: attr(e.open, 'data-id'),
    href: attr(e.open, 'href') ?? /\bhref="([^"]*)"/.exec(e.inner)?.[1] ?? null,
    text: text(e.inner),
    mastered: field('endgame-mastered'),
    streak: field('endgame-streak'),
    attempts: field('endgame-attempts'),
  };
}

/** The card with this data-id, or undefined. */
export const cardById = (html, id) => levelsOf(html).flatMap((l) => l.cards).find((c) => c.id === id);

// ---- browser ----

/** A signed-in page of `user`. opts: { viewport } */
export const endgamesPage = (browser, baseUrl, user, { viewport } = {}) =>
  newVisitorPage(browser, { baseUrl, session: user.token, viewport });

export async function openEndgames(page, baseUrl) {
  await page.goto(`${baseUrl}/endgames`, { waitUntil: 'networkidle' });
  await page.getByTestId('endgames-level-1').waitFor({ state: 'visible' });
}

/** Clicks the card of `id`. */
export const clickCard = (page, id) => page.locator(`[data-testid="endgame-card"][data-id="${id}"]`).click();

/** The card of `id` as shown in the browser → { mastered (badge text or null), streak, attempts }. */
export async function cardShown(page, id) {
  const card = page.locator(`[data-testid="endgame-card"][data-id="${id}"]`);
  const field = async (tid) => {
    const e = card.getByTestId(tid);
    return (await e.count()) && (await e.isVisible()) ? (await e.innerText()).replace(/[\s  ]+/g, ' ').trim() : null;
  };
  return { mastered: await field('endgame-mastered'), streak: await field('endgame-streak'), attempts: await field('endgame-attempts') };
}
