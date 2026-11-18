// US-86: backfillOpenings over more than one batch of 500 (1,201 games, PGLITE_DATA_DIR=memory://).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { countWithoutOpening, gamesModule, insertGames, insertUser, processDb, storedGame } from '../support/openings-db';

let games: Awaited<ReturnType<typeof gamesModule>>;
let db: Awaited<ReturnType<typeof processDb>>;
let userId: string;
let ids: string[];

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  games = await gamesModule();
  db = await processDb();
  userId = await insertUser(db, `${crypto.randomUUID()}@example.test`);
  ids = await insertGames(db, userId, [
    { moves: '1. e4 c5', n: 601 },
    { moves: '1. a3', n: 600 },
  ]);
}, 120000);

describe('backfillOpenings with 1,201 games without an opening', () => {
  it('every one of them gets a name', async () => {
    expect(ids).toHaveLength(1201);
    expect(await countWithoutOpening(db, userId)).toBe(1201);
    const n = await games.backfillOpenings();
    expect(n).toBe(1201);
    expect(await countWithoutOpening(db, userId)).toBe(0);
    expect(await storedGame(db, ids[0])).toEqual({ eco: 'B20', opening: 'Sicilian Defense' });
    expect(await storedGame(db, ids[1200])).toEqual({ eco: 'A00', opening: "Anderssen's Opening" });
  }, 120000);
});
