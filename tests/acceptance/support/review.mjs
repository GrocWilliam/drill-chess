// Domain layer for storing a game's analysis (US-45): the game to analyse, analysis bodies, POST /api/games/:id/analysis.
// No assertions of a criterion here: helpers return values, tests compare them.
import { Chess } from 'chess.js';
import { gameDetails, listedGames, openGame, openGames } from './games.mjs';
import { waitForImportEnd } from './imports.mjs';
import { linkAccount } from './links.mjs';
import { archiveGames, utcMonth } from './fakes/chesscom-games.mjs';

/** The chess.com game number of the fake's alpha_pawn game used as G (month 0, `1. e4 c5 2. Nf3 d6 0-1`). */
export const G_NUMBER = '100000001';
/** chess.com game numbers of the fake's alpha_pawn games: U played Black in BLACK_GAME, White in WHITE_GAME. */
export const BLACK_GAME = G_NUMBER;
export const WHITE_GAME = '100000002';

/** The fake's PGN of G. */
export function fakePgn(gameNumber = G_NUMBER) {
  const { year, month } = utcMonth(0);
  return archiveGames('alpha_pawn', year, month).find((g) => g.url.endsWith(`/${gameNumber}`)).pgn;
}

/** What a PGN holds: { plies, whiteMoves, firstMoveUci }. */
export function pgnFacts(pgn) {
  const c = new Chess();
  c.loadPgn(pgn);
  const moves = c.history({ verbose: true });
  return {
    plies: moves.length,
    whiteMoves: moves.filter((m) => m.color === 'w').length,
    firstMoveUci: moves[0] ? `${moves[0].from}${moves[0].to}${moves[0].promotion ?? ''}` : null,
  };
}

/**
 * Links chess.com alpha_pawn for `user` and waits for the import to end done (throws otherwise).
 * The fake's games: 100000001 (U played Black, 4 plies), 100000002 (U played White, 6 plies).
 */
export async function importAlphaPawn(baseUrl, user) {
  const r = await linkAccount(baseUrl, user.token, { site: 'chesscom', username: 'alpha_pawn' });
  if (r.status !== 303) throw new Error(`setup: linking chess.com alpha_pawn gave ${r.status}`);
  const job = await waitForImportEnd(baseUrl, user.token, 'chesscom', 20000);
  if (job?.status !== 'done') throw new Error(`setup: the import did not end done: ${JSON.stringify(job)}`);
}

/** The id of the imported game of `user` with chess.com game number `number` (throws when absent). */
export async function gameIdByNumber(baseUrl, token, number) {
  const rows = listedGames((await openGames(baseUrl, token, { acceptLanguage: 'en' })).html);
  for (const row of rows) {
    const d = gameDetails((await openGame(baseUrl, token, row.id, { acceptLanguage: 'en' })).html);
    if (d.siteLinkHref?.endsWith(`/${number}`)) return row.id;
  }
  throw new Error(`setup: game ${number} not found among ${rows.length} imported games`);
}

/** The analysis body of the chess.com game `number`: {cp: 0} then P × {cp} (White's first move loses). */
export function dropBodyOf(number, cp) {
  const { plies } = pgnFacts(fakePgn(number));
  return analysisBody({ evals: dropAfterFirstMove(plies, cp), best: times(plies, null) });
}

/** The zeros analysis body of the chess.com game `number` (every move as good as the one before). */
export function zerosBodyOf(number) {
  return zerosBody(pgnFacts(fakePgn(number)).plies);
}

/**
 * Links chess.com alpha_pawn for `user`, waits for the import, and finds G among the imported games.
 * → { id, pgn, plies, whiteMoves, firstMoveUci }; throws when the setup fails.
 */
export async function importedGame(baseUrl, user) {
  await importAlphaPawn(baseUrl, user);
  const rows = listedGames((await openGames(baseUrl, user.token, { acceptLanguage: 'en' })).html);
  for (const row of rows) {
    const d = gameDetails((await openGame(baseUrl, user.token, row.id, { acceptLanguage: 'en' })).html);
    if (d.siteLinkHref?.endsWith(`/${G_NUMBER}`)) {
      const pgn = fakePgn();
      return { id: row.id, pgn, ...pgnFacts(pgn) };
    }
  }
  throw new Error(`setup: game ${G_NUMBER} not found among ${rows.length} imported games`);
}

/** `n` copies of `v`. */
export const times = (n, v) => Array.from({ length: n }, () => structuredClone(v));

/** P + 1 times {cp: 0}. */
export const zeros = (plies) => times(plies + 1, { cp: 0 });

/** {cp: 0} followed by P times {cp: <cp>} (the position after White's first move and every later one). */
export const dropAfterFirstMove = (plies, cp) => [{ cp: 0 }, ...times(plies, { cp })];

/** An analysis body: { depth, evals, best } plus any extra fields. */
export const analysisBody = ({ depth = 6, evals, best, ...extra }) => ({ depth, evals, best, ...extra });

/** The zeros body of G: depth 6, P + 1 zeros, P nulls. */
export const zerosBody = (plies) => analysisBody({ evals: zeros(plies), best: times(plies, null) });

/** `list` with entry `i` replaced by `v`. */
export const withEntry = (list, i, v) => list.map((x, j) => (j === i ? v : x));

/**
 * POST /api/games/<id>/analysis. `body` is sent as JSON, or as-is when `raw` is a string; `token` may be null.
 * → { status, contentType, body } (body parsed JSON, or null).
 */
export async function postAnalysis(baseUrl, token, gameId, body, { raw } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', Origin: baseUrl };
  if (token) headers.Cookie = `session=${token}`;
  const r = await fetch(`${baseUrl}/api/games/${gameId}/analysis`, {
    method: 'POST',
    headers,
    body: raw ?? JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await r.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: r.status, contentType: r.headers.get('content-type') ?? '', body: parsed };
}

/** The error of an error answer: { code, field } (field undefined when absent). */
export const errorOf = (answer) => ({ code: answer.body?.error?.code, field: answer.body?.error?.field });


// ---- analyses for the /stats mistakes block (US-73) ----
/** Body in which only Black's first move (ply 2) loses 300 cp: a blunder of the player who has Black. */
export function blackDropBodyOf(number, cp = 300) {
  const { plies } = pgnFacts(fakePgn(number));
  return analysisBody({ evals: [{ cp: 0 }, { cp: 0 }, ...times(plies - 1, { cp })], best: times(plies, null) });
}

/** Saves `body` for the chess.com game `number` of `user`; throws unless the server answers 201. */
export async function saveAnalysisOf(baseUrl, user, number, body) {
  const id = await gameIdByNumber(baseUrl, user.token, number);
  const r = await postAnalysis(baseUrl, user.token, id, body);
  if (r.status !== 201) throw new Error(`setup: saving the analysis of ${number} gave ${r.status}`);
}

/** The user's two analysed games: White's first move blunders in WHITE_GAME (user White), Black's in BLACK_GAME (user Black). */
export async function saveTwoAnalyses(baseUrl, user) {
  await saveAnalysisOf(baseUrl, user, WHITE_GAME, dropBodyOf(WHITE_GAME, -900));
  await saveAnalysisOf(baseUrl, user, BLACK_GAME, blackDropBodyOf(BLACK_GAME, 900));
}
