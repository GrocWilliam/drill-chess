// Database setup helpers for the review module (US-45), for Vitest acceptance tests run on the process `db`
// with PGLITE_DATA_DIR=memory://. Setup only: no assertions of a criterion here.
import { fakePgn, pgnFacts } from './review.mjs';

/** Migrates the in-memory database and loads the review module → { saveAnalysis, getAnalysis, accuracies }. */
export async function reviewModule() {
  const dbm = await import('../../../src/lib/server/db/index');
  await dbm.migrate();
  return await import('../../../src/lib/server/review/index');
}

/** A user with one imported chess.com game G (the fake's alpha_pawn game, made-up players) → { userId, gameId, plies }. */
export async function userWithGame() {
  const { db } = await import('../../../src/lib/server/db/index');
  const { users } = await import('../../../src/lib/server/accounts/schema');
  const { games } = await import('../../../src/lib/server/games/schema');
  const [u] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash: 'x' }).returning();
  const pgn = fakePgn();
  const { plies } = pgnFacts(pgn);
  const [g] = await db
    .insert(games)
    .values({
      userId: u.id, site: 'chesscom', siteGameId: crypto.randomUUID(), url: 'https://www.chess.com/game/live/100000001',
      endedAt: new Date(), timeClass: 'blitz', clock: '180+2', colour: 'black', result: 'win',
      whiteName: 'made_up_rival', blackName: 'Alpha_Pawn', pgn, plies,
    })
    .returning();
  return { userId: u.id as string, gameId: g.id as string, plies };
}
