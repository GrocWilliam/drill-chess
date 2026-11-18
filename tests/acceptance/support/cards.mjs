// Domain layer for the card review endpoint (US-91). Setup and reads only: no assertion of a criterion here.
// The built app keeps its database in its own process, so card ids are read from a PGlite data directory:
// the app runs on a disk directory, is stopped (it closes the database), the ids are read, then it restarts.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { startServer } from './server.mjs';
import { signedUpUser } from './accounts.mjs';
import { START_FEN, addMoveOver, fenAfter } from './repertoire.mjs';

/** A server on a disk database that can restart: { url, dir, restart(), stop() }. */
export async function restartableApp() {
  const dir = mkdtempSync(join(tmpdir(), 'drill-chess-pg-'));
  const state = { dir, app: await startServer({ env: { PGLITE_DATA_DIR: dir } }), url: null };
  state.url = state.app.url;
  state.stopServer = async () => state.app?.stop();
  state.restart = async () => {
    await state.app.stop();
    state.app = await startServer({ env: { PGLITE_DATA_DIR: dir } });
    state.url = state.app.url;
  };
  state.stop = async () => {
    await state.app?.stop();
    rmSync(dir, { recursive: true, force: true });
  };
  return state;
}

/** The cards (id, ease, interval_days, reps, due_on) of the user with this email, . Run while the app is stopped. */
export async function cardsInDir(dir, email) {
  const db = new PGlite(dir);
  try {
    const r = await db.query(
      `select c.id, c.ease, c.interval_days, c.reps, to_char(c.due_on, 'YYYY-MM-DD') as due_on
         from cards c join users u on u.id = c.user_id where u.email = $1 order by c.id`, [email]);
    return r.rows.map((x) => ({ id: x.id, ease: Number(x.ease), interval_days: Number(x.interval_days), reps: Number(x.reps), due_on: x.due_on }));
  } finally {
    await db.close();
  }
}

/**
 * Creates one user per entry of `counts` (1 or 2 player cards in a white repertoire: 1.e4, then 1...e5 2.Nf3 for 2) over HTTP,
 * restarts the app once, and reads the cards → [{ user, cards }].
 */
export async function usersWithCards(app, counts) {
  const users = [];
  for (const n of counts) {
    const user = await signedUpUser(app.url);
    const moves = [[START_FEN, 'e2e4']];
    if (n === 2) moves.push([fenAfter('e2e4'), 'e7e5'], [fenAfter('e2e4', 'e7e5'), 'g1f3']);
    for (const [fen, uci] of moves) await addMoveOver(app.url, user.token, 'white', fen, uci);
    users.push(user);
  }
  await app.restart();
  const out = [];
  for (const user of users) out.push({ user, cards: await cardsInDir(app.dir, user.email) });
  await app.restart();
  return out;
}

/** POST /api/openings/cards/<id>/review. `body` as JSON, or `raw` text; token may be null. → { status, body } */
export async function reviewOver(baseUrl, token, id, body, { raw } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', Origin: baseUrl };
  if (token) headers.Cookie = `session=${token}`;
  const r = await fetch(`${baseUrl}/api/openings/cards/${id}/review`, {
    method: 'POST', headers, body: raw ?? JSON.stringify(body), redirect: 'manual',
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: r.status, body: parsed };
}

export const reviewCorrect = (baseUrl, token, id, correct = true) => reviewOver(baseUrl, token, id, { correct });

/** The UTC date `days` days from now, 'YYYY-MM-DD'. */
export const utcDay = (days = 0, now = Date.now()) => new Date(now + days * 86400000).toISOString().slice(0, 10);
