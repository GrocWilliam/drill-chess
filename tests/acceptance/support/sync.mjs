// Domain layer for syncing new games (US-20): the sync form post, the sync buttons, setting up imported users.
// No assertions of a criterion here: helpers return values, tests compare them.
import { signedUpUser } from './accounts.mjs';
import { hasTestId, linkAccount, textOf } from './links.mjs';
import { waitForImportEnd } from './imports.mjs';

/** Submits `POST /games?/sync` as a plain HTML form with the session → { status, location, html }. */
export async function syncGames(baseUrl, token, site) {
  const r = await fetch(`${baseUrl}/games?/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
      Origin: baseUrl,
      Cookie: `session=${token}`,
    },
    body: new URLSearchParams({ site }).toString(),
    redirect: 'manual',
  });
  return { status: r.status, location: r.headers.get('location'), html: await r.text() };
}

/** A signed-up user who linked `links` ([{ site, username }]) one after the other, each import done → { token, ... }. */
export async function userWithImports(env, links, opts = {}) {
  const user = await signedUpUser(env.app.url, opts);
  for (const l of links) {
    const r = await linkAccount(env.app.url, user.token, { site: l.site, username: l.username });
    if (r.status !== 303) throw new Error(`setup: linking ${l.username} answered ${r.status}`);
    const job = await waitForImportEnd(env.app.url, user.token, l.site);
    if (job?.status !== 'done') throw new Error(`setup: import of ${l.username} ended ${job?.status}`);
  }
  return user;
}

/** How many elements of the server-rendered HTML carry data-testid="games-sync-<site>". */
export const syncButtonCount = (html, site) => (html.match(new RegExp(`data-testid="games-sync-${site}"`, 'g')) ?? []).length;

/** The label of the sync button of `site` ('' when absent). */
export const syncButtonLabel = (html, site) => (hasTestId(html, `games-sync-${site}`) ? textOf(html, `games-sync-${site}`) : '');

/** Browser: the sync button of `site`. */
export const syncButton = (page, site) => page.locator(`[data-testid="games-sync-${site}"]`);

/** Browser: { width, height } of the sync button of `site`. */
export async function syncButtonSize(page, site) {
  return (await syncButton(page, site).boundingBox()) ?? { width: 0, height: 0 };
}

/** Browser: presses the sync button of `site`. */
export const pressSync = (page, site) => syncButton(page, site).click();
