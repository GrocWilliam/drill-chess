// Domain layer for rate-limited calls and failed imports (US-21): the fake's per-player request log, users whose
// import failed, the failed status line. No assertions of a criterion here: helpers return values, tests compare them.
import { signedUpUser } from './accounts.mjs';
import { elementHtml, linkAccount } from './links.mjs';
import { pageText } from './accounts.mjs';
import { waitForImportEnd } from './imports.mjs';

/** The fake's requests about `player` (any path naming it), in arrival order. */
export const requestsAbout = (requests, player) =>
  requests.filter((q) => q.path.split('?')[0].toLowerCase().split('/').includes(player.toLowerCase()));

/** { path: [arrival ms, ...] } of `requests`. */
export function arrivalsByPath(requests) {
  const by = {};
  for (const q of requests) (by[q.path] ??= []).push(q.at);
  return by;
}

/** How many of `requests` asked for exactly `path` (a trailing slash ignored). */
export const timesRequested = (requests, path) => requests.filter((q) => q.path.replace(/\/$/, '') === path).length;

/** A signed-up user who linked `site` `username`, the import ended (done or failed) → { token, job, ... }. */
export async function userWithEndedImport(env, { site, username }, opts = {}) {
  const user = await signedUpUser(env.app.url, opts);
  const r = await linkAccount(env.app.url, user.token, { site, username });
  if (r.status !== 303) throw new Error(`setup: linking ${username} answered ${r.status}`);
  const job = await waitForImportEnd(env.app.url, user.token, site, opts.timeoutMs ?? 30000);
  return { ...user, job };
}

/** A signed-up user whose import of `site` `username` ended `failed` → { token, job, ... }. */
export async function userWithFailedImport(env, link, opts = {}) {
  const user = await userWithEndedImport(env, link, opts);
  if (user.job?.status !== 'failed') throw new Error(`setup: import of ${link.username} ended ${user.job?.status}`);
  return user;
}

/** Polls `read()` every 250 ms until `done(value)` or `timeoutMs` → the last value read. */
export async function waitUntil(read, done, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  let v;
  for (;;) {
    v = await read();
    if (done(v) || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
}

const SPACES = /[\s  ]+/g;

/** The text of `games-status` without any Sync button it may hold, all whitespace as single spaces ('' when absent). */
export function statusLineText(html) {
  const inner = elementHtml(html, 'games-status');
  if (inner === null) return '';
  const withoutButtons = inner.replace(/<(button|a)\b[^>]*data-testid="games-sync-[^"]*"[^>]*>[\s\S]*?<\/\1>/g, ' ');
  return pageText(withoutButtons).replace(SPACES, ' ').trim();
}

/** Whether `games-status`, or an element inside it, has role="alert". */
export function statusLineIsAlert(html) {
  const open = /<[a-zA-Z][^>]*\bdata-testid="games-status"[^>]*>/.exec(html)?.[0];
  if (!open) return false;
  return /\brole="alert"/.test(open) || /\brole="alert"/.test(elementHtml(html, 'games-status') ?? '');
}

/** Browser: the `games-status` line. */
export const statusLine = (page) => page.getByTestId('games-status');
