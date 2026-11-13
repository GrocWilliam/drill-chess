// HTTP domain layer for accounts: sign up, log out, signed-in visits, cookie and form reads.
// No assertions of a criterion here: helpers return values, tests compare them.
import { randomUUID } from 'node:crypto';
import { visit } from './visitor.mjs';

/** A fresh, unique fixture email (never a real address). */
export function uniqueEmail(prefix = 'player') {
  return `${prefix}.${randomUUID().slice(0, 8)}@example.test`;
}

/** A password of exactly `n` characters. */
export function passwordOf(n) {
  return 'p'.repeat(n);
}

/** Parses one Set-Cookie line → { name, value, attrs } (attribute names lower-cased; flags map to true). */
function parseSetCookie(line) {
  const [pair, ...rest] = line.split(';');
  const i = pair.indexOf('=');
  const attrs = {};
  for (const a of rest) {
    const j = a.indexOf('=');
    const k = (j < 0 ? a : a.slice(0, j)).trim().toLowerCase();
    if (k) attrs[k] = j < 0 ? true : a.slice(j + 1).trim();
  }
  return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), attrs };
}

/** The `session` Set-Cookie of a response, or null when none is set. */
function sessionCookieOf(response) {
  const lines = response.headers.getSetCookie?.() ?? [];
  return lines.map(parseSetCookie).find((c) => c.name === 'session') ?? null;
}

/** Submits a SvelteKit form action as a browser without JavaScript would (a plain HTML form post, same origin). */
async function postForm(baseUrl, path, fields, { acceptLanguage, cookies = {} } = {}) {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'text/html',
    Origin: baseUrl,
  };
  if (acceptLanguage !== undefined) headers['Accept-Language'] = acceptLanguage;
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(baseUrl + path, {
    method: 'POST',
    headers,
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  });
  return {
    status: r.status,
    location: r.headers.get('location'),
    session: sessionCookieOf(r),
    html: await r.text(),
  };
}

/**
 * Submits the signup form (`POST /signup`, default action).
 * → { status, location, session: { value, attrs } | null, html }
 */
export function signUp(baseUrl, { email, password, acceptLanguage }) {
  return postForm(baseUrl, '/signup', { email, password }, { acceptLanguage });
}

/** Signs up a new user with a unique email → { email, password, token }; throws if no session was started. */
export async function signedUpUser(baseUrl, { acceptLanguage = 'en', email = uniqueEmail() } = {}) {
  const password = 'correct-horse-1';
  const r = await signUp(baseUrl, { email, password, acceptLanguage });
  if (!r.session?.value) throw new Error(`setup: signup of ${email} gave ${r.status} without a session cookie`);
  return { email, password, token: r.session.value };
}

/** Presses Log out (`POST /logout`) with the session cookie → { status, location, session, html }. */
export function logOut(baseUrl, token) {
  return postForm(baseUrl, '/logout', {}, { cookies: { session: token } });
}

/** GET `path` with a session cookie (plus optional other cookies and Accept-Language) → { status, location, html }. */
export function visitAs(baseUrl, token, { path = '/', acceptLanguage, cookies = {} } = {}) {
  return visit(baseUrl, { path, acceptLanguage, cookies: { ...cookies, session: token } });
}

/** The path and query of a redirect Location (resolved against the app), or null. */
export function redirectTarget(baseUrl, location) {
  if (location == null) return null;
  const u = new URL(location, baseUrl);
  return u.pathname + u.search;
}

/** The `value` attribute of the input with `data-testid="<testid>"` in server-rendered HTML, or null if absent. */
export function inputValue(html, testid) {
  const tag = new RegExp(`<input\\b[^>]*\\bdata-testid="${testid}"[^>]*>`, 'i').exec(html)?.[0];
  if (!tag) return null;
  const v = /\bvalue="([^"]*)"/.exec(tag)?.[1];
  return v === undefined ? '' : v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** The visible text of a server-rendered page (tags removed, common entities decoded, whitespace collapsed). */
export function pageText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[\s  ]+/g, ' ');
}

/**
 * Submits the login form (`POST /login`). `next` goes in the query string (`nextIn: 'query'`) or in the form
 * body (`nextIn: 'form'`, default). → { status, location, session: { value, attrs } | null, html }
 */
export function logIn(baseUrl, { email, password, next, nextIn = 'form', acceptLanguage }) {
  const fields = { email, password };
  let path = '/login';
  if (next !== undefined) {
    if (nextIn === 'query') path += `?next=${encodeURIComponent(next)}`;
    else fields.next = next;
  }
  return postForm(baseUrl, path, fields, { acceptLanguage });
}

/** The `value` of the hidden `next` field of a server-rendered login page, or null when there is none. */
export function hiddenNext(html) {
  const tags = html.match(/<input\b[^>]*>/gi) ?? [];
  const tag = tags.find((t) => /\bname="next"/i.test(t));
  if (!tag) return null;
  const v = /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? '';
  return v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** Posts `n` logins with a wrong password for `email` → the list of responses. */
export async function failLogins(baseUrl, email, n, { acceptLanguage } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(await logIn(baseUrl, { email, password: 'wrong-password-9', acceptLanguage }));
  return out;
}
