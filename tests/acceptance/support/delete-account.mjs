// Domain layer for deleting the account (HTTP and browser). No assertions of a criterion here.
import { visitAs } from './accounts.mjs';

/** GET /account?modal=delete-account signed in → { status, location, html }. */
export const openDeleteDialog = (baseUrl, token) => visitAs(baseUrl, token, { path: '/account?modal=delete-account' });

/** Submits `POST /account?/delete` as a plain HTML form → { status, location, cookieLines, html }. */
export async function deleteAccount(baseUrl, token, password) {
  const r = await fetch(baseUrl + '/account?/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
      Origin: baseUrl,
      Cookie: `session=${token}`,
    },
    body: new URLSearchParams({ password }).toString(),
    redirect: 'manual',
  });
  return {
    status: r.status,
    location: r.headers.get('location'),
    cookieLines: r.headers.getSetCookie?.() ?? [],
    html: await r.text(),
  };
}

/** Whether the response's Set-Cookie lines clear the `session` cookie (empty value, Max-Age<=0 or past Expires). */
export function clearsSessionCookie(cookieLines) {
  const line = cookieLines.find((l) => l.trim().startsWith('session='));
  if (!line) return false;
  const parts = line.split(';').map((s) => s.trim());
  if (parts[0] === 'session=') return true;
  const maxAge = parts.find((p) => /^max-age=/i.test(p));
  if (maxAge && Number(maxAge.split('=')[1]) <= 0) return true;
  const exp = parts.find((p) => /^expires=/i.test(p));
  return !!exp && new Date(exp.slice(8)).getTime() < Date.now();
}

/** The opening tag of the element with this data-testid in server-rendered HTML, or null. */
export function openingTag(html, testid) {
  return new RegExp(`<[a-z0-9]+\\b[^>]*\\bdata-testid="${testid}"[^>]*>`, 'i').exec(html)?.[0] ?? null;
}

/** Whether `modal-delete-account` is a <dialog> carrying the `open` attribute. */
export function deleteDialogIsOpen(html) {
  const tag = openingTag(html, 'modal-delete-account');
  return !!tag && /^<dialog\b/i.test(tag) && /\sopen(\s|=|>|\/)/i.test(tag);
}

/** The HTML inside the delete dialog (up to its closing tag), or ''. */
export function deleteDialogHtml(html) {
  const i = html.search(/<dialog\b[^>]*data-testid="modal-delete-account"/i);
  if (i < 0) return '';
  const j = html.indexOf('</dialog>', i);
  return html.slice(i, j < 0 ? undefined : j);
}

// ---- browser ----
export const openAccountDeleteLink = (page) => page.getByTestId('account-delete');
export const deleteDialog = (page) => page.getByTestId('modal-delete-account');

/** Types the password in the dialog and presses `delete-confirm`. */
export async function confirmDeletion(page, password) {
  await page.getByTestId('delete-password').fill(password);
  await page.getByTestId('delete-confirm').click();
}

/** Visible links and buttons inside the delete dialog: [{ testid, width, height }]. */
export function dialogTargets(page) {
  return page.getByTestId('modal-delete-account').evaluate((d) =>
    [...d.querySelectorAll('a[href], button, [role="button"]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
      .map(({ el, r }) => ({ testid: el.dataset.testid ?? el.textContent.trim(), width: r.width, height: r.height })));
}

/** The dialog's bounding box. */
export const dialogBox = (page) => page.getByTestId('modal-delete-account').boundingBox();
