// A fake chess.com + Lichess on one free port. Behaviour depends on the made-up username:
// `nobody_*` → 404, `broken_*` → 500, anything else exists (200, JSON).
// Paths: GET /pub/player/<u> (chess.com), GET /api/user/<u> (Lichess), GET /__fake/requests (the request log).
// Lichess games: GET /api/games/user/<u>?since=<ms>... streams NDJSON (./lichess-games.mjs: `beta_rook` has games over months 0..-3,
//   only those with lastMoveAt >= since; any other player has none).
// chess.com game archives: GET /pub/player/<u>/games/archives and /pub/player/<u>/games/YYYY/MM.
//   `alpha_pawn` has the archives of ./chesscom-games.mjs (months 0, -1, -2, -3, listed as https://api.chess.com/...
//   URLs, plus one https://api.chess.com/other/path URL); `stalled_*` lists months -2, -1 and 0 with the month -2
//   games of alpha_pawn (under its own name), and its months -1 and 0 answer 500; any other player has no archive.
// US-21: `busy_*` usernames answer 429 with `Retry-After: 1` the first time each path is requested, then normally;
//   `busy_bishop` lists months -1 and 0 (./chesscom-games.mjs: 2 games in month 0, 1 in month -1).
//   `failing_*` usernames exist; on chess.com they list months -2, -1 and 0 and their month 0 archive always answers
//   500 (`failing_rook`: 2 games in month -2, 1 in month -1); their Lichess game stream always answers 500.
// US-50: `review_rook` (chess.com) lists month 0 only, with its 2 games of ./chesscom-games.mjs.
// US-23: `many_pawns` (Lichess) streams 5,005 standard games mp000001..mp005005 (see ./lichess-games.mjs).
// US-110: tablebase GET /standard?fen= (./tablebase.mjs); POST /__fake/tablebase/fail {"count": n} makes the next n
//   /standard requests answer 500 (they are still logged).
// Every logged request carries `at` (epoch ms of its arrival).
import http from 'node:http';
import { freePort } from '../server.mjs';
import { extraLine, streamLines } from './lichess-games.mjs';
import { standardFen, tablebaseAnswer } from './tablebase.mjs';
import { ARCHIVE_OFFSETS, archiveGames, extraGame, month0Games, monthPath, utcMonth } from './chesscom-games.mjs';

const CHESSCOM_API = 'https://api.chess.com';

/** The answer to a chess.com archives path, or null when the path is not one. → [status, body] */
function chesscomArchives(path, extras = []) {
  const m = /^\/pub\/player\/([^/?#]+)\/games\/(?:(archives)|(\d{4})\/(\d{2}))\/?$/.exec(path);
  if (!m) return null;
  const name = decodeURIComponent(m[1]).toLowerCase();
  if (name.startsWith('nobody_')) return [404, { message: 'not found' }];
  if (name.startsWith('broken_')) return [500, { message: 'broken' }];
  if (name.startsWith('failing_')) {
    if (m[2]) return [200, { archives: [-2, -1, 0].map((o) => `${CHESSCOM_API}/pub/player/${name}/games/${monthPath(utcMonth(o))}`) }];
    const m0 = utcMonth(0);
    if (Number(m[3]) === m0.year && Number(m[4]) === m0.month) return [500, { message: 'failing' }];
    return [200, { games: archiveGames(name, Number(m[3]), Number(m[4])) }];
  }
  if (name.startsWith('busy_')) {
    if (m[2]) return [200, { archives: name === 'busy_bishop' ? [-1, 0].map((o) => `${CHESSCOM_API}/pub/player/${name}/games/${monthPath(utcMonth(o))}`) : [] }];
    return [200, { games: archiveGames(name, Number(m[3]), Number(m[4])) }];
  }
  if (name === 'opening_owl') {
    if (m[2]) return [200, { archives: [`${CHESSCOM_API}/pub/player/${name}/games/${monthPath(utcMonth(-1))}`] }];
    return [200, { games: archiveGames(name, Number(m[3]), Number(m[4])) }];
  }
  if (name === 'slow_knight' || name === 'review_rook' || name === 'rating_rook' || name === 'rating_bishop' || name === 'rating_pawn') {
    if (m[2]) return [200, { archives: [`${CHESSCOM_API}/pub/player/${name}/games/${monthPath(utcMonth(0))}`] }];
    return [200, { games: archiveGames(name, Number(m[3]), Number(m[4])) }];
  }
  const fixture = name === 'alpha_pawn' ? 'alpha_pawn' : name.startsWith('stalled_') ? 'stalled' : null;
  if (m[2]) {
    const offsets = fixture === 'alpha_pawn' ? [...ARCHIVE_OFFSETS].sort((a, b) => a - b) : fixture ? [-2, -1, 0] : [];
    const archives = offsets.map((o) => `${CHESSCOM_API}/pub/player/${name}/games/${monthPath(utcMonth(o))}`);
    if (fixture === 'alpha_pawn') archives.push(`${CHESSCOM_API}/other/path`);
    return [200, { archives }];
  }
  const year = Number(m[3]);
  const month = Number(m[4]);
  if (fixture === 'stalled') {
    const old = utcMonth(-2);
    if (old.year !== year || old.month !== month) return [500, { message: 'broken' }];
  }
  const added = extras.filter((g) => {
    const m0 = utcMonth(0);
    return m0.year === year && m0.month === month && g.name === name;
  }).map((g) => g.game);
  return [200, { games: [...(fixture ? archiveGames(name, year, month) : []), ...added] }];
}

/** → { url, requests(), stop() }; requests() is [{ method, path, headers }] in arrival order. */
export async function startFake() {
  const log = [];
  const addedChesscom = []; // { name, game }
  const addedLichess = []; // { name, line }
  const busySeen = new Set(); // paths of busy_* players already answered 429
  let tablebaseFailures = 0; // the next n /standard requests answer 500
  const server = http.createServer((req, res) => {
    const path = req.url ?? '/';
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (path === '/__fake/requests') return json(200, log);
    if (req.method === 'POST' && path === '/__fake/tablebase/fail') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        tablebaseFailures = Number(JSON.parse(raw || '{}').count) || 0;
        json(200, { ok: true });
      });
      return;
    }
    if (req.method === 'POST' && path === '/__fake/add-game') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const { site, username, game } = JSON.parse(raw);
        const name = String(username).toLowerCase();
        const now = Date.now();
        if (site === 'chesscom') {
          const newest = Math.max(...month0Games(name).map((g) => g.end_time), ...addedChesscom.filter((a) => a.name === name).map((a) => a.game.end_time));
          addedChesscom.push({ name, game: extraGame(name, game, Math.max(Math.floor(now / 1000), newest + 1)) });
        } else {
          const all = streamLines(name, 0, new Date(), addedLichess.filter((a) => a.name === name).map((a) => a.line)).map((l) => JSON.parse(l).lastMoveAt);
          addedLichess.push({ name, line: extraLine(name, game, Math.max(now, ...all) + (all.length ? 1000 : 0)) });
        }
        json(200, { ok: true });
      });
      return;
    }
    log.push({ method: req.method, path, headers: { ...req.headers }, at: Date.now() });
    if (/^\/(?:pub\/player|api\/user|api\/games\/user)\/busy_/i.test(path) && !busySeen.has(path)) {
      busySeen.add(path);
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '1' });
      return void res.end(JSON.stringify({ message: 'too many requests' }));
    }
    // `slow_*` usernames: every response comes 3 s late.
    if (/^\/(?:pub\/player|api\/user|api\/games\/user)\/slow_/i.test(path)) return void setTimeout(() => answer(req, res, path, json), 3000);
    answer(req, res, path, json);
  });
  function answer(req, res, path, json) {
    if (req.method === 'GET' && new URL(path, 'http://fake').pathname === '/standard') {
      if (tablebaseFailures > 0) {
        tablebaseFailures -= 1;
        return json(500, { error: 'failing' });
      }
      return json(...tablebaseAnswer(standardFen(path)));
    }
    const stream = req.method === 'GET' ? /^\/api\/games\/user\/([^/?#]+)(?:\?(.*))?$/.exec(path) : null;
    if (stream) {
      const name = decodeURIComponent(stream[1]).toLowerCase();
      if (name.startsWith('nobody_')) return json(404, { message: 'not found' });
      if (name.startsWith('broken_') || name.startsWith('failing_')) return json(500, { message: 'broken' });
      const since = Number(new URLSearchParams(stream[2] ?? '').get('since') ?? 0);
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      return res.end(streamLines(name, since, new Date(), addedLichess.filter((a) => a.name === name).map((a) => a.line)).map((l) => `${l}\n`).join(''));
    }
    const archives = req.method === 'GET' ? chesscomArchives(path, addedChesscom) : null;
    if (archives) return json(...archives);
    const m = /^\/(?:pub\/player|api\/user)\/([^/?#]*)/.exec(path);
    if (req.method !== 'GET' || !m) return json(404, { message: 'not found' });
    const name = decodeURIComponent(m[1]).toLowerCase();
    if (name.startsWith('nobody_')) return json(404, { message: 'not found' });
    if (name.startsWith('broken_')) return json(500, { message: 'broken' });
    return json(200, { username: name });
  }
  const port = await freePort();
  await new Promise((res) => server.listen(port, '127.0.0.1', res));
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    /** US-20: makes a new game appear in the month-0 archive (chesscom) or the stream (lichess), newer than all others. */
    addGame: async (site, username, game) => {
      const r = await fetch(`${url}/__fake/add-game`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site, username, game }) });
      if (!r.ok) throw new Error(`setup: add-game answered ${r.status}`);
    },
    /** US-110: the next `count` tablebase /standard requests answer 500. */
    failTablebase: async (count) => {
      const r = await fetch(`${url}/__fake/tablebase/fail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count }) });
      if (!r.ok) throw new Error(`setup: tablebase/fail answered ${r.status}`);
    },
    requests: async () => (await fetch(`${url}/__fake/requests`)).json(),
    stop: () => new Promise((res) => (server.closeAllConnections?.(), server.close(res))),
  };
}
