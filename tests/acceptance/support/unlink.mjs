// Domain layer for unlinking a username (HTTP and browser). No assertions of a criterion here.
import { visitAs } from './accounts.mjs';
import { openingTag } from './delete-account.mjs';

/** GET /account?modal=unlink-<site> signed in → { status, location, html }. */
export const openUnlinkDialog = (baseUrl, token, site, opts = {}) =>
  visitAs(baseUrl, token, { ...opts, path: `/account?modal=unlink-${site}` });

/** GET /account signed in. */
export const openAccount = (baseUrl, token, opts = {}) => visitAs(baseUrl, token, { ...opts, path: '/account' });

/** Submits `POST /account?/unlink` as a plain HTML form → { status, location, html }. */
export async function unlinkAccount(baseUrl, token, site) {
  const r = await fetch(`${baseUrl}/account?/unlink`, {
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

/** Whether `modal-unlink-<site>` is a <dialog> carrying the `open` attribute. */
export function unlinkDialogIsOpen(html, site) {
  const tag = openingTag(html, `modal-unlink-${site}`);
  return !!tag && /^<dialog\b/i.test(tag) && /\sopen(\s|=|>|\/)/i.test(tag);
}

/** The ids of the games listed on /games (data-game-id of each row). */
export const gameIds = (rows) => rows.map((r) => r.id);

// ---- browser ----
export const unlinkButton = (page, site) => page.getByTestId(`unlink-${site}`);
export const unlinkConfirm = (page, site) => page.getByTestId(`unlink-${site}-confirm`);
export const unlinkDialog = (page, site) => page.getByTestId(`modal-unlink-${site}`);

/** Visible links and buttons inside the dialog: [{ testid, width, height }]. */
export function unlinkDialogTargets(page, site) {
  return unlinkDialog(page, site).evaluate((d) =>
    [...d.querySelectorAll('a[href], button, [role="button"]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
      .map(({ el, r }) => ({ testid: el.dataset.testid ?? el.textContent.trim(), width: r.width, height: r.height })));
}
