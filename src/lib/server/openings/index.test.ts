import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Chess } from 'chess.js';

vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const NOW = new Date('2026-03-10T12:00:00Z');

let m: typeof import('./index');
let userId: string;
beforeAll(async () => {
  const { db, migrate } = await import('../db');
  await migrate();
  const { users } = await import('../accounts/schema');
  [{ id: userId }] = await db.insert(users).values({ email: 'o@example.test', passwordHash: 'x' }).returning();
  m = await import('./index');
}, 120_000);

describe('openings', () => {
  it('adds, repeats and summarises', async () => {
    const a = await m.addMove(userId, 'white', START, 'e2e4', NOW);
    expect(a).toMatchObject({ status: 'created', move: { san: 'e4', by: 'player' } });
    const b = await m.addMove(userId, 'white', START, 'e2e4', NOW);
    expect(b).toMatchObject({ status: 'exists' });
    expect(await m.addMove(userId, 'white', START, 'd2d4', NOW)).toEqual({ error: { code: 'player_move_exists', san: 'e4' } });
    expect(await m.addMove(userId, 'white', START, 'e2e5', NOW)).toEqual({ error: { code: 'illegal_move' } });
    expect((await m.summary(userId, NOW)).white).toEqual({ positions: 1, due: 1, learned: 0 });
    expect((await m.summary(userId, NOW)).black).toBeNull();
  });

  it('explores a line, cutting at the first illegal move', async () => {
    const e = await m.explore(userId, 'white', ['e2e4', 'c7c5', 'e1e5']);
    expect(e.line.map((x) => x.san)).toEqual(['e4', 'c5']);
    expect(e.opening?.eco).toBe('B20');
    expect((await m.explore(userId, 'white', [])).moves.map((x) => x.san)).toEqual(['e4']);
  });

  it('leaves no repertoire behind after an error', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(await m.addMove(userId, 'black', fen, 'c7c5', NOW)).toEqual({ error: { code: 'unknown_position' } });
    expect((await m.summary(userId, NOW)).black).toBeNull();
  });

  it('deletes a move with what only it reaches, and rejects strangers', async () => {
    const line = async (ucis: string[]) => {
      let fen = START;
      const ids: string[] = [];
      const { Chess } = await import('chess.js');
      for (const u of ucis) {
        const r = await m.addMove(userId, 'black', fen, u, NOW);
        if (!('move' in r)) throw new Error(JSON.stringify(r));
        ids.push(r.move.id);
        const c = new Chess(fen);
        c.move({ from: u.slice(0, 2), to: u.slice(2, 4) });
        fen = c.fen();
      }
      return ids;
    };
    const ids = await line(['e2e4', 'e7e5', 'g1f3']);
    expect(await m.deletePreview(userId, 'black', ids[1])).toEqual({ san: 'e5', count: 2 });
    expect(await m.deleteMove(userId, 'white', ids[1])).toBeNull();
    expect(await m.deleteMove(userId, 'black', 'abc')).toBeNull();
    expect(await m.deleteMove(userId, 'black', ids[1])).toEqual({ removed: 2 });
    expect((await m.explore(userId, 'black', ['e2e4'])).moves).toEqual([]);
  });
});

describe('nextLine', () => {
  const after = (...ucis: string[]) => {
    const c = new Chess();
    for (const u of ucis) c.move({ from: u.slice(0, 2), to: u.slice(2, 4) });
    return c.fen();
  };
  it('serves a due line, deterministic with a seed, then nextDue once reviewed', async () => {
    const { db } = await import('../db');
    const { users } = await import('../accounts/schema');
    const [{ id }] = await db.insert(users).values({ email: 'd@example.test', passwordHash: 'x' }).returning();
    expect(await m.nextLine(id, ['white', 'black'], NOW)).toEqual({ moves: [], nextDue: null });
    await m.addMove(id, 'white', START, 'e2e4', NOW);
    await m.addMove(id, 'white', after('e2e4'), 'e7e5', NOW);
    await m.addMove(id, 'white', after('e2e4', 'e7e5'), 'g1f3', NOW);
    const a = await m.nextLine(id, ['white', 'black'], NOW, 5);
    expect(a).toMatchObject({ colour: 'white', opening: { eco: 'C40' } });
    expect(a.moves.map((x) => [x.san, x.by, x.due, x.cardId === null])).toEqual([
      ['e4', 'player', true, false],
      ['e5', 'opponent', false, true],
      ['Nf3', 'player', true, false],
    ]);
    expect(await m.nextLine(id, ['white'], NOW, 5)).toEqual(a);
    for (const x of a.moves) if (x.cardId) await m.reviewCard(id, x.cardId, true, NOW);
    expect(await m.nextLine(id, ['white'], NOW)).toEqual({ moves: [], nextDue: '2026-03-11' });
    expect(await m.nextLine(userId, ['white'], NOW, 1)).toMatchObject({ colour: 'white' });
  });
});
