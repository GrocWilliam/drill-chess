// Domain layer for the drill endpoint (US-92): GET /api/openings/drill, repertoire setup over HTTP and the card ids
// read from the app's disk database (see support/cards.mjs). Setup and reads only: no assertion of a criterion here.
import { PGlite } from '@electric-sql/pglite';
import { addLine, addMoveOver, fenAfter } from './repertoire.mjs';
import { reviewCorrect } from './cards.mjs';

/**
 * GET /api/openings/drill with the query `params` (an object; a value of undefined is left out) and the session
 * `token` (null = signed out). → { status, body, ms } (ms = how long the answer took).
 */
export async function requestDrill(baseUrl, token, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
  const headers = { Accept: 'application/json' };
  if (token) headers.Cookie = `session=${token}`;
  const t0 = performance.now();
  const r = await fetch(`${baseUrl}/api/openings/drill${q.size ? `?${q}` : ''}`, { headers, redirect: 'manual' });
  const text = await r.text();
  const ms = performance.now() - t0;
  let body = null;
  try { body = JSON.parse(text); } catch { body = null; }
  return { status: r.status, body, ms };
}

/** The UCI moves of a drill answer's line. */
export const lineOf = (answer) => (answer.body?.moves ?? []).map((m) => m.uci);

/** The moves of a drill answer: [{ uci, san, by, cardId, due }]. */
export const movesOf = (answer) => answer.body?.moves ?? [];

/**
 * Builds a repertoire over HTTP from UCI lines played from the start position (shared prefixes are added once).
 * `lines` = [['e2e4', 'e7e5', 'g1f3'], ['e2e4', 'c7c5', 'g1f3']].
 */
export async function buildRepertoire(baseUrl, token, colour, lines) {
  for (const line of lines) {
    const answers = await addLine(baseUrl, token, colour, line);
    const bad = answers.find((a) => a.status !== 200 && a.status !== 201);
    if (bad) throw new Error(`setup: adding ${line.join(' ')} gave ${bad.status} ${JSON.stringify(bad.body)}`);
  }
}

/** Adds one move from the position after `before` (UCI moves from the start) over HTTP. */
export async function addMoveAfter(baseUrl, token, colour, before, uci) {
  const a = await addMoveOver(baseUrl, token, colour, fenAfter(...before), uci);
  if (a.status !== 200 && a.status !== 201) throw new Error(`setup: adding ${uci} gave ${a.status} ${JSON.stringify(a.body)}`);
  return a;
}

/**
 * The cards of the user with this email, read from the app's PGlite data directory (run while the app is stopped):
 * [{ id, colour, uci, fromFen, dueOn }].
 */
export async function cardsWithMoves(dir, email) {
  const db = new PGlite(dir);
  try {
    const r = await db.query(
      `select c.id, r.colour, m.uci, m.from_fen, to_char(c.due_on, 'YYYY-MM-DD') as due_on
         from cards c join users u on u.id = c.user_id
         join repertoire_moves m on m.id = c.repertoire_move_id
         join repertoires r on r.id = m.repertoire_id
        where u.email = $1 order by c.id`, [email]);
    return r.rows.map((x) => ({ id: x.id, colour: x.colour, uci: x.uci, fromFen: x.from_fen, dueOn: x.due_on }));
  } finally {
    await db.close();
  }
}

/**
 * Restarts the app once and reads the cards of every user → Map(email → cards), then restarts it again.
 * `app` is a restartableApp().
 */
export async function readCards(app, users) {
  await app.restart();
  const out = new Map();
  for (const u of users) out.set(u.email, await cardsWithMoves(app.dir, u.email));
  await app.restart();
  return out;
}

/** The card of the player move `uci` played from the position after `before` (UCI moves from the start). */
export function cardOfMove(cards, colour, before, uci) {
  const from = fenAfter(...before).split(' ').slice(0, 4).join(' ');
  const c = cards.find((x) => x.colour === colour && x.uci === uci && x.fromFen.split(' ').slice(0, 4).join(' ') === from);
  if (!c) throw new Error(`setup: no card for ${uci} after ${before.join(' ')}`);
  return c;
}

/** Reviews the cards correct over HTTP (each becomes due tomorrow); throws if one is refused. */
export async function reviewAll(baseUrl, token, cards) {
  for (const c of cards) {
    const r = await reviewCorrect(baseUrl, token, c.id, true);
    if (r.status !== 200) throw new Error(`setup: reviewing card ${c.id} gave ${r.status}`);
  }
}

/** The position (FEN without the move counters) after each prefix of the UCI line, the start position included. */
export function positionsOf(line) {
  const out = [];
  for (let i = 0; i <= line.length; i++) out.push(fenAfter(...line.slice(0, i)).split(' ').slice(0, 4).join(' '));
  return out;
}
