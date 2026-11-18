// Domain layer for the repertoire write API (US-87): HTTP calls, FEN helpers, and the generator of a big repertoire.
// Setup and reads only: no assertions of a criterion here.
import { Chess } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** The full FEN after playing the UCI moves from the start position. */
export function fenAfter(...ucis) {
  const c = new Chess();
  for (const u of ucis) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return c.fen();
}

/** POST /api/openings/<colour>/moves. `body` is sent as JSON, or as-is when `raw` is a string; `token` may be null. → { status, body } */
export async function postMove(baseUrl, token, colour, body, { raw } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', Origin: baseUrl };
  if (token) headers.Cookie = `session=${token}`;
  const r = await fetch(`${baseUrl}/api/openings/${colour}/moves`, {
    method: 'POST', headers, body: raw ?? JSON.stringify(body), redirect: 'manual',
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: r.status, body: parsed };
}

/** Adds a move over HTTP. */
export const addMoveOver = (baseUrl, token, colour, fromFen, uci) => postMove(baseUrl, token, colour, { fromFen, uci });

/** Adds the moves of a line in order from the start position over HTTP (each from the previous position) → the answers. */
export async function addLine(baseUrl, token, colour, ucis) {
  const answers = [];
  for (let i = 0; i < ucis.length; i++) answers.push(await addMoveOver(baseUrl, token, colour, fenAfter(...ucis.slice(0, i)), ucis[i]));
  return answers;
}

/** The error of an error answer: { code, field, message }. */
export const errorOf = (a) => ({ code: a.body?.error?.code, field: a.body?.error?.field, message: a.body?.error?.message });

const uciOfVerbose = (m) => m.from + m.to + (m.promotion ?? '');

/**
 * Builds a white repertoire of `target` player moves through `add(fromFen, uci)` → 'created' | 'exists' | other.
 * Breadth-first: a player move from each White-to-move position, then 1-2 Black replies.
 * → { created, pending: { fen, uci } (a legal White move from a reachable position without a player move),
 *     spare: { fen, uci } (a legal Black reply from a reachable position, not added) }
 */
export async function fillWhiteRepertoire(add, target) {
  const queue = [new Chess().fen()];
  let created = 0, n = 0, spare = null;
  const expanded = new Set();
  while (created < target && queue.length) {
    const fen = queue.shift();
    // A transposition reaches a position twice: it holds one player move, so expand it once.
    const key = fen.split(' ').slice(0, 4).join(' ');
    if (expanded.has(key)) continue;
    expanded.add(key);
    const c = new Chess(fen);
    const moves = c.moves({ verbose: true });
    if (!moves.length) continue;
    const m = moves[n++ % moves.length];
    const r = await add(fen, uciOfVerbose(m));
    if (r === 'created') created++;
    else if (r !== 'exists') throw new Error(`setup: adding ${uciOfVerbose(m)} gave ${r}`);
    c.move(m);
    const replies = c.moves({ verbose: true });
    const k = created + queue.length < target + 100 ? 2 : 1;
    const after = c.fen();
    for (let i = 0; i < replies.length && i < k; i++) {
      const rr = await add(after, uciOfVerbose(replies[i]));
      if (rr !== 'created' && rr !== 'exists') throw new Error(`setup: adding reply gave ${rr}`);
      const d = new Chess(after);
      d.move(replies[i]);
      queue.push(d.fen());
    }
    if (replies.length > k) spare = { fen: after, uci: uciOfVerbose(replies[k]) };
  }
  if (created < target) throw new Error('setup: could not build the repertoire');
  const fen = queue.find((f) => new Chess(f).moves().length);
  return { created, pending: { fen, uci: uciOfVerbose(new Chess(fen).moves({ verbose: true })[0]) }, spare };
}

/** DELETE /api/openings/<colour>/moves/<id> (US-90); `token` may be null. → { status, body } */
export async function deleteMoveOver(baseUrl, token, colour, id) {
  const headers = { Accept: 'application/json', Origin: baseUrl };
  if (token) headers.Cookie = `session=${token}`;
  const r = await fetch(`${baseUrl}/api/openings/${colour}/moves/${id}`, { method: 'DELETE', headers, redirect: 'manual' });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: r.status, body: parsed };
}

/** Adds a line over HTTP → the move ids, in order (throws when a move was not stored). */
export async function addLineIds(baseUrl, token, colour, ucis) {
  const answers = await addLine(baseUrl, token, colour, ucis);
  return answers.map((a, i) => {
    if (!a.body?.move?.id) throw new Error(`setup: move ${ucis[i]} gave ${a.status}`);
    return a.body.move.id;
  });
}
