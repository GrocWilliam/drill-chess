// Domain layer for import jobs: the import status endpoint, waiting for a job to end, the fake's archive requests.
// No assertions of a criterion here: helpers return values, tests compare them.
import { monthPath, utcMonth } from './fakes/chesscom-games.mjs';

/** GET /api/import/status, with the session when `token` is given → { status, contentType, body } (body parsed JSON or null). */
export async function importStatus(baseUrl, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Cookie = `session=${token}`;
  const r = await fetch(`${baseUrl}/api/import/status`, { headers, redirect: 'manual' });
  const text = await r.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: r.status, contentType: r.headers.get('content-type') ?? '', body };
}

/** The job of `site` in a status body, or undefined. */
export const jobOf = (body, site) => body?.jobs?.find?.((j) => j.site === site);

/** Only the fields the import status names. */
export const jobSummary = (job) =>
  job && { site: job.site, status: job.status, imported: job.imported, skipped: job.skipped, error: job.error };

/**
 * Polls GET /api/import/status every 250 ms until the job of `site` is `done` or `failed`, or `timeoutMs` passed.
 * → the last job of that site seen (undefined if none was ever listed).
 */
export async function waitForImportEnd(baseUrl, token, site, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let job;
  for (;;) {
    const r = await importStatus(baseUrl, token);
    job = jobOf(r.body, site);
    if (job && (job.status === 'done' || job.status === 'failed')) return job;
    if (Date.now() > deadline) return job;
    await new Promise((res) => setTimeout(res, 250));
  }
}

/** The path of the chess.com archive of `player` for the UTC month `offset` months from now. */
export const archivePath = (player, offset) => `/pub/player/${player}/games/${monthPath(utcMonth(offset))}`;

/** The paths of the chess.com month archive requests among `requests` (`/pub/player/<u>/games/YYYY/MM`). */
export const archiveRequestPaths = (requests) =>
  requests.map((q) => q.path).filter((p) => /^\/pub\/player\/[^/]+\/games\/\d{4}\/\d{2}\/?$/.test(p));

/** The paths among `requests` that start with `prefix`. */
export const pathsStartingWith = (requests, prefix) => requests.map((q) => q.path).filter((p) => p.startsWith(prefix));

/** The requests among `requests` for the Lichess games of `player`. */
export const lichessStreamRequests = (requests, player) =>
  requests.filter((q) => q.path.split('?')[0] === `/api/games/user/${player}`);

/** The query of a request path as URLSearchParams. */
export const queryOf = (path) => new URLSearchParams(path.split('?')[1] ?? '');
