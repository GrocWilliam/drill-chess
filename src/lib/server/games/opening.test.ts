import { beforeAll, describe, expect, it, vi } from 'vitest';

let db: typeof import('../db').db;
let schema: typeof import('./schema');
let o: typeof import('./opening');
let userId: string;
let n = 0;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  ({ db } = await import('../db'));
  await (await import('../db')).migrate();
  schema = await import('./schema');
  o = await import('./opening');
  const { users } = await import('../accounts/schema');
  userId = (await db.insert(users).values({ email: 'o@example.test', passwordHash: 'x' }).returning())[0].id;
}, 120_000);

const row = (pgn: string, over: { eco?: string | null; opening?: string | null } = {}) => ({
  userId,
  site: 'lichess' as const,
  siteGameId: `g${n++}`,
  url: 'https://lichess.org/x',
  endedAt: new Date(Date.UTC(2026, 0, 1) + n * 1000),
  timeClass: 'blitz',
  clock: '180+0',
  colour: 'white',
  result: 'win',
  whiteName: 'a',
  blackName: 'b',
  pgn,
  plies: 2,
  eco: null as string | null,
  opening: null as string | null,
  ...over,
});

describe('withOpening', () => {
  it('fills the name and a missing ECO, and keeps a site name', () => {
    expect(o.withOpening({ pgn: '1. e4 c5', eco: null, opening: null })).toMatchObject({ eco: 'B20', opening: 'Sicilian Defense' });
    expect(o.withOpening({ pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', eco: 'C50', opening: null }).eco).toBe('C50');
    const named = { pgn: '1. e4 c5', eco: 'X', opening: 'Mine' };
    expect(o.withOpening(named)).toEqual(named);
  });
});

describe('backfillOpenings', () => {
  it('names games without one, leaves the rest, and is idempotent', async () => {
    const [a, b, c, d] = (
      await db
        .insert(schema.games)
        .values([
          row('1. e4 c5'),
          row('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', { eco: 'C50' }),
          row('1. e4 c5', { eco: 'B20', opening: 'Site name' }),
          row('*'),
        ])
        .returning({ id: schema.games.id })
    ).map((r) => r.id);
    expect(await o.backfillOpenings()).toBe(2);
    const get = (id: string) => db.query.games.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    expect(await get(a)).toMatchObject({ eco: 'B20', opening: 'Sicilian Defense' });
    const italian = await get(b);
    expect(italian?.eco).toBe('C50');
    expect(italian?.opening).toMatch(/^Italian Game/);
    expect((await get(c))?.opening).toBe('Site name');
    expect((await get(d))?.opening).toBeNull();
    expect(await o.backfillOpenings()).toBe(0);
  });

  it('handles more than one batch', async () => {
    await db.insert(schema.games).values([...Array(1201)].map(() => row('1. d4 d5')));
    expect(await o.backfillOpenings()).toBe(1201);
    expect(await o.backfillOpenings()).toBe(0);
  }, 120_000);
});
