// Domain layer for the account page preferences (HTTP and browser). No assertions of a criterion here.
import { visitAs } from './accounts.mjs';

/** Submits `POST /account?/preferences` as a plain HTML form with the session cookie → { status, location, html }. */
export async function savePreferences(baseUrl, token, fields, { cookies = {} } = {}) {
  const cookie = Object.entries({ ...cookies, session: token }).map(([k, v]) => `${k}=${v}`).join('; ');
  const r = await fetch(baseUrl + '/account?/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
      Origin: baseUrl,
      Cookie: cookie,
    },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  });
  return { status: r.status, location: r.headers.get('location'), html: await r.text() };
}

/** Opens the page a save redirected to (path and query of the Location), signed in. */
export function followRedirect(baseUrl, token, location) {
  const u = new URL(location, baseUrl);
  return visitAs(baseUrl, token, { path: u.pathname + u.search });
}

/** GET /account signed in. */
export const openAccount = (baseUrl, token, opts = {}) => visitAs(baseUrl, token, { ...opts, path: '/account' });

/** The value of the selected option of the select with this data-testid in server-rendered HTML, or null. */
export function selectedOption(html, testid) {
  const sel = new RegExp(`<select\\b[^>]*\\bdata-testid="${testid}"[^>]*>([\\s\\S]*?)</select>`, 'i').exec(html)?.[1];
  if (sel === undefined) return null;
  const opts = sel.match(/<option\b[^>]*>/gi) ?? [];
  const tag = opts.find((o) => /\bselected\b/i.test(o));
  if (!tag) return null;
  return /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? null;
}

/** The [value, label] pairs of the options of the select with this data-testid. */
export function selectOptions(html, testid) {
  const sel = new RegExp(`<select\\b[^>]*\\bdata-testid="${testid}"[^>]*>([\\s\\S]*?)</select>`, 'i').exec(html)?.[1] ?? '';
  return [...sel.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((m) => [
    /\bvalue="([^"]*)"/.exec(m[1])?.[1] ?? null,
    m[2].replace(/<[^>]+>/g, '').trim(),
  ]);
}

/** The text of the element with data-testid `toast` in server-rendered HTML, or null. */
export function toastText(html) {
  const m = /<([a-z0-9]+)\b[^>]*\bdata-testid="toast"[^>]*>([\s\S]*?)<\/\1>/i.exec(html);
  return m ? m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null;
}

/** Browser: opens /account. */
export const openAccountPage = (page, baseUrl) => page.goto(baseUrl + '/account');

/** Browser: picks a language in `account-lang` and presses `account-save`; waits for the saved page. */
export async function saveLanguageThroughForm(page, lang) {
  await page.getByTestId('account-lang').selectOption(lang);
  await page.getByTestId('account-save').click();
  await page.waitForURL((u) => u.pathname === '/account' && u.searchParams.get('saved') === '1');
}

export const toast = (page) => page.getByTestId('toast');

/** Browser: whether the toast is gone within `ms` (polled, not slept). */
export async function toastGoneWithin(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await toast(page).count()) === 0 || !(await toast(page).first().isVisible())) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}
