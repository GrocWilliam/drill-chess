// Domain layer for the openings home /openings (US-89): HTTP reads of the server-rendered page and browser
// actions on it. Actions and reads only: no assertion of a criterion here.
import { redirectTarget, visitAs } from './accounts.mjs';
import { visit } from './visitor.mjs';
import { allElements, attr, text } from './repertoire-page.mjs';
import { newVisitorPage } from './pages.mjs';
import { savePreferences } from './preferences.mjs';

export { redirectTarget };

/** GET /openings as a visitor without a session → { status, location, html }. */
export const homeAsVisitor = (baseUrl) => visit(baseUrl, { path: '/openings' });

/** GET /openings signed in (optionally with the lang cookie) → { status, location, html }. */
export async function homeHtml(baseUrl, token, { lang } = {}) {
  // A signed-in user's stored language wins over the cookie: store it first.
  if (lang) await savePreferences(baseUrl, token, { lang, theme: 'system' });
  return visitAs(baseUrl, token, { path: '/openings', cookies: lang ? { lang } : {} });
}

/** The inner HTML of the card of `colour` ('white' | 'black') in server-rendered HTML, or null. */
export function cardOf(html, colour) {
  return allElements(html, `openings-${colour}`)[0]?.inner ?? null;
}

/** The first element with this data-testid inside `scope` → { text, href } (href null when absent), or null. */
export function fieldOf(scope, testid) {
  const e = allElements(scope, testid)[0];
  return e ? { text: text(e.inner), href: attr(e.open, 'href') } : null;
}

// ---- browser ----

/** A signed-in page of `user` (English unless `lang` is given). opts: { lang, viewport } */
export function homePage(browser, baseUrl, user, { lang, viewport } = {}) {
  return newVisitorPage(browser, {
    baseUrl, session: user.token, lang, viewport, acceptLanguage: lang === 'fr' ? 'fr-FR' : 'en-US',
  });
}

/** Opens /openings and waits until the cards are visible. */
export async function openHome(page, baseUrl) {
  await page.goto(`${baseUrl}/openings`, { waitUntil: 'networkidle' });
  await page.getByTestId('openings-white').waitFor({ state: 'visible' });
}
