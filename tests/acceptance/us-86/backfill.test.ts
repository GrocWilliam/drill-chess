// US-86: backfillOpenings on the process database (PGLITE_DATA_DIR=memory://). Tests run in order on one database.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { chessOpenings, gamesModule, insertGames, insertUser, processDb, storedGame } from '../support/openings-db';

let games: Awaited<ReturnType<typeof gamesModule>>;
let db: Awaited<ReturnType<typeof processDb>>;
const ids: Record<'sicilian' | 'italian' | 'named' | 'empty', string> = {} as never;
let userId: string;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  games = await gamesModule();
  db = await processDb();
  userId = await insertUser(db, `${crypto.randomUUID()}@example.test`);
  const [sicilian, italian, named, empty] = await insertGames(db, userId, [
    { moves: '1. e4 c5', eco: null, opening: null },
    { moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', eco: 'C50', opening: null },
    { moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', eco: 'C50', opening: 'Made-up site name' },
    { moves: '', eco: null, opening: null },
  ]);
  Object.assign(ids, { sicilian, italian, named, empty });
});

describe('backfillOpenings', () => {
  it('names the games without opening, keeps the others, and returns the number updated (2)', async () => {
    const n = await games.backfillOpenings();
    expect(n).toBe(2);
    expect(await storedGame(db, ids.sicilian)).toEqual({ eco: 'B20', opening: 'Sicilian Defense' });
    const { openingFor } = await chessOpenings();
    const italian = await storedGame(db, ids.italian);
    expect(italian.eco).toBe('C50');
    expect(italian.opening).toBe(openingFor('e2e4 e7e5 g1f3 b8c6 f1c4 f8c5'.split(' '))?.name);
    expect(italian.opening).toMatch(/^Italian Game/);
    expect(await storedGame(db, ids.named)).toEqual({ eco: 'C50', opening: 'Made-up site name' });
    expect(await storedGame(db, ids.empty)).toEqual({ eco: null, opening: null });
  });

  it('called again it returns 0 and changes nothing', async () => {
    await games.backfillOpenings();
    const before = await Promise.all(Object.values(ids).map((id) => storedGame(db, id)));
    expect(await games.backfillOpenings()).toBe(0);
    const after = await Promise.all(Object.values(ids).map((id) => storedGame(db, id)));
    expect(after).toEqual(before);
  });
});
