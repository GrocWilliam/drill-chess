// Database setup helpers for the opening names of the game-import module (US-86), for Vitest acceptance tests run
// on the process `db` with PGLITE_DATA_DIR=memory:// (or on a connection of their own). Setup and reads only.
import { eq } from 'drizzle-orm';

/** Migrates the process database → { backfillOpenings }. */
export async function gamesModule() {
  const dbm = await import('../../../src/lib/server/db/index');
  await dbm.migrate();
  return await import('../../../src/lib/server/games/index');
}

export const chessOpenings = () => import('../../../src/lib/chess/openings');
export const chessRules = () => import('../../../src/lib/chess/rules');

export const PGN_HEADERS = '[Event "Made-up game"]\n[White "made_up_white"]\n[Black "made_up_black"]\n[Result "*"]\n\n';

export interface GameValues {
  eco?: string | null;
  opening?: string | null;
  moves: string;
  n?: number;
}

type Db = Awaited<typeof import('../../../src/lib/server/db/index')>['db'];

/** Inserts a fresh user → its id. `hash` is stored as the password hash. */
export async function insertUser(db: Db, email: string, hash = 'x'): Promise<string> {
  const { users } = await import('../../../src/lib/server/accounts/schema');
  const [u] = await db.insert(users).values({ email, passwordHash: hash }).returning();
  return u.id as string;
}

const gameRow = (userId: string, g: GameValues, i: number) => ({
  userId, site: 'chesscom' as const, siteGameId: `made-up-${crypto.randomUUID()}-${i}`, url: 'https://example.test/game',
  endedAt: new Date(Date.now() - (i + 1) * 60_000), timeClass: 'blitz' as const, clock: '180+2', colour: 'white' as const,
  result: 'draw' as const, whiteName: 'made_up_white', blackName: 'made_up_black',
  eco: g.eco ?? null, opening: g.opening ?? null, pgn: `${PGN_HEADERS}${g.moves ? `${g.moves} ` : ''}*\n`,
  plies: g.moves.split(/\s+/).filter((t) => t && !/^\d+\.$/.test(t)).length,
});

/** Inserts the games (each `n` times, default 1, in chunks) of `userId` → the ids of the games, in order. */
export async function insertGames(db: Db, userId: string, specs: GameValues[]): Promise<string[]> {
  const { games } = await import('../../../src/lib/server/games/schema');
  const rows = specs.flatMap((g) => Array.from({ length: g.n ?? 1 }, () => g)).map((g, i) => gameRow(userId, g, i));
  const ids: string[] = [];
  for (let i = 0; i < rows.length; i += 400) {
    const part = await db.insert(games).values(rows.slice(i, i + 400)).returning({ id: games.id });
    ids.push(...part.map((r) => r.id as string));
  }
  return ids;
}

/** { eco, opening } of a stored game. */
export async function storedGame(db: Db, id: string): Promise<{ eco: string | null; opening: string | null }> {
  const { games } = await import('../../../src/lib/server/games/schema');
  const [r] = await db.select({ eco: games.eco, opening: games.opening }).from(games).where(eq(games.id, id));
  return r;
}

/** How many games of `userId` still have no opening name. */
export async function countWithoutOpening(db: Db, userId: string): Promise<number> {
  const { games } = await import('../../../src/lib/server/games/schema');
  const { isNull, and } = await import('drizzle-orm');
  const rows = await db.select({ id: games.id }).from(games).where(and(eq(games.userId, userId), isNull(games.opening)));
  return rows.length;
}

/** The process database (migrated). */
export async function processDb(): Promise<Db> {
  const dbm = await import('../../../src/lib/server/db/index');
  await dbm.migrate();
  return dbm.db;
}

/** Links the chess.com username `username` to `userId` without importing (the /games list needs a linked account). */
export async function insertLink(db: Db, userId: string, username: string): Promise<void> {
  const { linkedAccounts } = await import('../../../src/lib/server/games/schema');
  await db.insert(linkedAccounts).values({ userId, site: 'chesscom', username });
}
