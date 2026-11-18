// HTTP domain layer for the endgame tablebase relay (US-110). No assertions of a criterion here.
import { standardFen } from './fakes/tablebase.mjs';

/** GET /api/endgames/<id>/reply?fen=<fen> (no `fen` param when fen is undefined) → { status, body } (parsed JSON or null). */
export async function askReply(baseUrl, token, id, fen) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Cookie = `session=${token}`;
  const q = fen === undefined ? '' : `?fen=${encodeURIComponent(fen)}`;
  const r = await fetch(`${baseUrl}/api/endgames/${id}/reply${q}`, { headers, redirect: 'manual' });
  const text = await r.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: r.status, body };
}

/** The FENs of every /standard request the fake tablebase received, in arrival order. */
export async function tablebaseRequestFens(fake) {
  return (await fake.requests()).map((r) => standardFen(r.path)).filter((f) => f !== null);
}

/** How many /standard requests the fake received for exactly `fen`. */
export async function tablebaseHitsFor(fake, fen) {
  return (await tablebaseRequestFens(fake)).filter((f) => f === fen).length;
}
