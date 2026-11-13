// Domain layer for password reset: HTTP form posts and browser actions. No assertions of a criterion here.
import { waitForMailTo, resetLinkIn } from './mail.mjs';
import { visit } from './visitor.mjs';

async function post(baseUrl, path, fields, { acceptLanguage, cookies = {} } = {}) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Origin: baseUrl };
  if (acceptLanguage !== undefined) headers['Accept-Language'] = acceptLanguage;
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(baseUrl + path, { method: 'POST', headers, body: new URLSearchParams(fields).toString(), redirect: 'manual' });
  const session = (r.headers.getSetCookie?.() ?? []).find((l) => l.startsWith('session='));
  return {
    status: r.status,
    location: r.headers.get('location'),
    session: session ? { value: session.split(';')[0].slice('session='.length) } : null,
    html: await r.text(),
  };
}

/** Submits the reset request form (`POST /reset`) → { status, location, session, html }. */
export const requestReset = (baseUrl, email, opts) => post(baseUrl, '/reset', { email }, opts);

/** GET /reset/<token> → { status, location, html }. */
export const openResetLink = (baseUrl, token) => visit(baseUrl, { path: `/reset/${token}` });

/** Submits the new password form (`POST /reset/<token>`) → { status, location, session, html }. */
export const submitNewPassword = (baseUrl, token, password) => post(baseUrl, `/reset/${token}`, { password });

/** Requests a reset for `email` and returns the link from the mail it triggers → { url, token }; throws if none. */
export async function resetLinkFor(app, email) {
  const r = await requestReset(app.url, email);
  if (r.status !== 200) throw new Error(`setup: POST /reset gave ${r.status}`);
  const mail = await waitForMailTo(app.outbox, email);
  const link = resetLinkIn(mail?.text);
  if (!link) throw new Error(`setup: no reset link in the outbox for ${email}`);
  return link;
}

/** Browser: fills `reset-email`, presses `reset-submit` and waits for the answer to render. */
export async function requestResetThroughForm(page, baseUrl, email) {
  await page.goto(baseUrl + '/reset');
  await page.getByTestId('reset-email').fill(email);
  await page.getByTestId('reset-submit').click();
  await page.getByTestId('reset-email').waitFor({ state: 'attached' });
  await page.waitForLoadState('load');
}

/** Browser: fills `reset-password`, presses `reset-password-submit`; waits until the page leaves /reset/. */
export async function setNewPasswordThroughForm(page, password) {
  await page.getByTestId('reset-password').fill(password);
  await page.getByTestId('reset-password-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/reset'));
}
