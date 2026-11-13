// Domain layer for linking a chess.com or Lichess username: the app wired to the fake sites, form posts, page reads.
// No assertions of a criterion here: helpers return values, tests compare them.
import { randomUUID } from 'node:crypto';
import { pageText } from './accounts.mjs';
import { startFake } from './fakes/server.mjs';
import { startServer } from './server.mjs';

/** Starts the fake sites, then the app with CHESSCOM_URL and LICHESS_URL pointing at it → { app, fake, stop() }. */
export async function startAppWithFakeSites() {
  const fake = await startFake();
  let app;
  try {
    app = await startServer({ chesscomUrl: fake.url, lichessUrl: fake.url });
  } catch (e) {
    await fake.stop();
    throw e;
  }
  return { app, fake, stop: async () => { await app.stop(); await fake.stop(); } };
}

/** A unique made-up username with the given prefix (e.g. `nobody_`, `broken_`, `player_`). */
export const madeUpName = (prefix = 'player_') => `${prefix}${randomUUID().slice(0, 8)}`;

/** Submits `POST <page>?/link` as a plain HTML form with the session → { status, location, html }. */
export async function linkAccount(baseUrl, token, { page = '/account', site, username }) {
  const r = await fetch(`${baseUrl}${page}?/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
      Origin: baseUrl,
      Cookie: `session=${token}`,
    },
    body: new URLSearchParams({ site, username }).toString(),
    redirect: 'manual',
  });
  return { status: r.status, location: r.headers.get('location'), html: await r.text() };
}

/** The inner HTML of the element with this data-testid in server-rendered HTML, or null when absent. */
export function elementHtml(html, testid) {
  const open = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\bdata-testid="${testid}"[^>]*>`).exec(html);
  if (!open) return null;
  const tag = open[1];
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let m; (m = re.exec(html)); ) {
    depth += m[1] ? -1 : /\/>$/.test(m[0]) ? 0 : 1;
    if (depth === 0) return html.slice(open.index + open[0].length, m.index);
  }
  return html.slice(open.index + open[0].length);
}

/** Whether an element with this data-testid is in the server-rendered HTML. */
export const hasTestId = (html, testid) => new RegExp(`data-testid="${testid}"`).test(html);

/** The visible text of the element with this data-testid ('' when absent). */
export const textOf = (html, testid) => pageText(elementHtml(html, testid) ?? '').trim();

/** The visible text of the `link-<site>` row of /account. */
export const linkRowText = (html, site) => textOf(html, `link-${site}`);

/** The requests the fake received after the first `n`. */
export const requestsAfter = async (fake, n) => (await fake.requests()).slice(n);
export const requestCount = async (fake) => (await fake.requests()).length;
