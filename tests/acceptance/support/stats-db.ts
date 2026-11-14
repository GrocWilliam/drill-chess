// Database setup helpers for the stats module (US-66), for Vitest acceptance tests run on the process `db`
// with PGLITE_DATA_DIR=memory://. Setup and reads only: no assertions of a criterion here.

type Site = 'chesscom' | 'lichess';
type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily';
type Colour = 'white' | 'black';
type Result = 'win' | 'draw' | 'loss';

/** Migrates the in-memory database → { parseStatsFilters, getStats, scorePercent }. */
export async function statsModule() {
  const dbm = await import('../../../src/lib/server/db/index');
  await dbm.migrate();
  const filters = await import('../../../src/lib/server/stats/filters');
  const stats = await import('../../../src/lib/server/stats/index');
  return { parseStatsFilters: filters.parseStatsFilters, getStats: stats.getStats };
}

/** The pure score function of `stats/score.ts`. */
export async function scoreModule() {
  return await import('../../../src/lib/server/stats/score');
}

/** The pure filters parser of `stats/filters.ts`. */
export async function filtersModule() {
  return await import('../../../src/lib/server/stats/filters');
}

/** A fresh user with no game → its id. */
export async function newUser(): Promise<string> {
  const { db } = await import('../../../src/lib/server/db/index');
  const { users } = await import('../../../src/lib/server/accounts/schema');
  const [u] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash: 'x' }).returning();
  return u.id as string;
}

export interface GameSpec {
  site?: Site;
  timeClass?: TimeClass;
  colour: Colour;
  result: Result;
  endedAt?: Date;
  eco?: string | null;
  opening?: string | null;
}

const PGN = '[Event "Made-up game"]\n[White "made_up_white"]\n[Black "made_up_black"]\n[Result "*"]\n\n1. e4 e5 *\n';

/** Inserts one game of `userId` (defaults: chess.com, blitz, ended an hour ago) → its id. */
export async function addGame(userId: string, g: GameSpec): Promise<string> {
  const { db } = await import('../../../src/lib/server/db/index');
  const { games } = await import('../../../src/lib/server/games/schema');
  const [row] = await db
    .insert(games)
    .values({
      userId, site: g.site ?? 'chesscom', siteGameId: crypto.randomUUID(), url: 'https://example.test/game',
      endedAt: g.endedAt ?? new Date(Date.now() - 3600_000), timeClass: g.timeClass ?? 'blitz', clock: '180+2',
      colour: g.colour, result: g.result, whiteName: 'made_up_white', blackName: 'made_up_black', pgn: PGN, plies: 2, eco: g.eco ?? null, opening: g.opening ?? null,
    })
    .returning();
  return row.id as string;
}

/** Inserts `n` games of the same kind. */
export async function addGames(userId: string, n: number, g: GameSpec): Promise<void> {
  for (let i = 0; i < n; i++) await addGame(userId, g);
}

/** Stores an analysis of the 2-ply game `gameId` of `userId` directly in `analyses`. */
export async function addAnalysis(userId: string, gameId: string): Promise<void> {
  const { db } = await import('../../../src/lib/server/db/index');
  const { analyses } = await import('../../../src/lib/server/review/schema');
  await db.insert(analyses).values({
    gameId, userId, depth: 6, evals: [{ cp: 20 }, { cp: -300 }, { cp: -280 }], best: ['d2d4', null],
    marks: [null, 'mistake'], phases: ['opening', 'opening'], accuracyWhite: 91.4, accuracyBlack: 62.7,
  });
}

/** Every row of `games` and `analyses` (all users), ordered by id, as stored. */
export async function allGameAndAnalysisRows() {
  const { db } = await import('../../../src/lib/server/db/index');
  const { games } = await import('../../../src/lib/server/games/schema');
  const { analyses } = await import('../../../src/lib/server/review/schema');
  const g = await db.select().from(games).orderBy(games.id);
  const a = await db.select().from(analyses).orderBy(analyses.gameId);
  return { games: g, analyses: a };
}

/** `URLSearchParams` of a query string ('' = the empty query). */
export const query = (q: string) => new URLSearchParams(q);

/** The instant `days` × 24 h before `now`. */
export const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * 24 * 3600_000);
