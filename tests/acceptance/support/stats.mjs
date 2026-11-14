// HTTP domain layer for the statistics endpoint (US-66): GET /api/stats, the user's imported games.
// No assertions of a criterion here: helpers return values, tests compare them.
import { listedGames } from './games.mjs';
import { visitAs } from './accounts.mjs';
import { linkHref } from './paging.mjs';

/** GET /api/stats?<query> with the session (token may be null) → { status, contentType, body } (body parsed JSON or null). */
export async function requestStats(baseUrl, token, query = '') {
  const headers = { Accept: 'application/json' };
  if (token) headers.Cookie = `session=${token}`;
  const r = await fetch(`${baseUrl}/api/stats${query ? `?${query}` : ''}`, { headers, redirect: 'manual' });
  const text = await r.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: r.status, contentType: r.headers.get('content-type') ?? '', body };
}

/** The games the user's /games list shows (every page, `?<query>` filters) → [{ id, text, hrefs }]. */
export async function listedGamesOf(baseUrl, token, query = '') {
  const out = [];
  let path = `/games${query ? `?${query}` : ''}`;
  for (let i = 0; i < 200 && path; i++) {
    const { html } = await visitAs(baseUrl, token, { path, acceptLanguage: 'en' });
    out.push(...listedGames(html));
    const next = linkHref(html, 'games-next');
    path = next ? new URL(next, baseUrl).pathname + new URL(next, baseUrl).search : null;
  }
  return out;
}

/** The sum of `games` over the rows of a stats block (e.g. `colour`). */
export const gamesIn = (rows) => (rows ?? []).reduce((n, r) => n + r.games, 0);

/** The `openings` rows of GET /api/stats?<query> (200 expected by the test through `status`) → { status, rows }. */
export async function requestOpenings(baseUrl, token, query = '') {
  const r = await requestStats(baseUrl, token, query);
  return { status: r.status, rows: r.body?.openings ?? null, colour: r.body?.colour ?? null };
}
