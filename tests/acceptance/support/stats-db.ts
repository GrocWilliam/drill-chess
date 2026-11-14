// Database setup helpers for the stats module (US-66), for Vitest acceptance tests run on the process `db`
// with PGLITE_DATA_DIR=memory:// (US-66, US-69). Setup and reads only: no assertions of a criterion here.

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
  whiteRating?: number | null;
  blackRating?: number | null;
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
      colour: g.colour, result: g.result, whiteRating: g.whiteRating ?? null, blackRating: g.blackRating ?? null, whiteName: 'made_up_white', blackName: 'made_up_black', pgn: PGN, plies: 2, eco: g.eco ?? null, opening: g.opening ?? null,
    })
    .returning();
  return row.id as string;
}

/** Inserts `n` games of the same kind. */
export async function addGames(userId: string, n: number, g: GameSpec): Promise<void> {
  for (let i = 0; i < n; i++) await addGame(userId, g);
}

type Mark = 'inaccuracy' | 'mistake' | 'blunder' | null;
type PhaseName = 'opening' | 'middlegame' | 'endgame';

export interface AnalysisSpec {
  marks: Mark[];
  phases: PhaseName[];
  accuracyWhite: number;
  accuracyBlack: number;
}

/** A stored-analysis row for `gameId`: evals/best sized to the marks (contents irrelevant to the stats). */
const analysisRow = (userId: string, gameId: string, a: AnalysisSpec) => ({
  gameId, userId, depth: 6,
  evals: Array.from({ length: a.marks.length + 1 }, () => ({ cp: 0 })),
  best: Array.from({ length: a.marks.length }, () => null),
  marks: a.marks, phases: a.phases, accuracyWhite: a.accuracyWhite, accuracyBlack: a.accuracyBlack,
});

/**
 * Stores an analysis of game `gameId` of `userId` directly in `analyses`. Without `a`: the 2-ply analysis
 * marks [null, 'mistake'], phases opening, accuracies 91.4 / 62.7.
 */
export async function addAnalysis(userId: string, gameId: string, a?: AnalysisSpec): Promise<void> {
  const { db } = await import('../../../src/lib/server/db/index');
  const { analyses } = await import('../../../src/lib/server/review/schema');
  const spec = a ?? { marks: [null, 'mistake'], phases: ['opening', 'opening'], accuracyWhite: 91.4, accuracyBlack: 62.7 };
  await db.insert(analyses).values(analysisRow(userId, gameId, spec));
}

/** Inserts one game of `userId` and stores its analysis → the game's id. */
export async function addAnalysedGame(userId: string, g: GameSpec, a: AnalysisSpec): Promise<string> {
  const id = await addGame(userId, g);
  await addAnalysis(userId, id, a);
  return id;
}

/**
 * Bulk setup: inserts `n` games of `userId` in batches (sites, time classes, colours and results cycle; ended
 * one hour apart going back from an hour ago) → their ids, newest first.
 */
export async function addManyGames(userId: string, n: number): Promise<string[]> {
  const { db } = await import('../../../src/lib/server/db/index');
  const { games } = await import('../../../src/lib/server/games/schema');
  const sites: Site[] = ['chesscom', 'lichess'];
  const times: TimeClass[] = ['bullet', 'blitz', 'rapid', 'classical', 'daily'];
  const results: Result[] = ['win', 'draw', 'loss'];
  const ids: string[] = [];
  const start = Date.now() - 3600_000;
  for (let i = 0; i < n; i += 500) {
    const rows = Array.from({ length: Math.min(500, n - i) }, (_, k) => {
      const j = i + k;
      return {
        userId, site: sites[j % 2], siteGameId: crypto.randomUUID(), url: 'https://example.test/game',
        endedAt: new Date(start - j * 3600_000), timeClass: times[j % 5], clock: '180+2',
        colour: (j % 2 === 0 ? 'white' : 'black') as Colour, result: results[j % 3],
        whiteName: 'made_up_white', blackName: 'made_up_black', pgn: PGN, plies: 60,
      };
    });
    const out = await db.insert(games).values(rows).returning({ id: games.id });
    ids.push(...out.map((r) => r.id as string));
  }
  return ids;
}

/** Bulk setup: stores the same analysis `a` for every game of `gameIds` (of `userId`), in batches. */
export async function addManyAnalyses(userId: string, gameIds: string[], a: AnalysisSpec): Promise<void> {
  const { db } = await import('../../../src/lib/server/db/index');
  const { analyses } = await import('../../../src/lib/server/review/schema');
  for (let i = 0; i < gameIds.length; i += 200) {
    await db.insert(analyses).values(gameIds.slice(i, i + 200).map((id) => analysisRow(userId, id, a)));
  }
}

/** Milliseconds `fn` takes to resolve → { ms, value }. */
export async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const t0 = performance.now();
  const value = await fn();
  return { ms: performance.now() - t0, value };
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

/** A series as `getStats` returns it, with `n` points (for `pickSeries`). */
export function seriesOf(site: Site, time: TimeClass, n: number) {
  const points = Array.from({ length: n }, (_, i) => ({
    at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), rating: 1500 + i,
  }));
  return { site, time, points };
}
