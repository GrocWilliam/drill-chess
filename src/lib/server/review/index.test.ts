import { beforeAll, describe, expect, it, vi } from 'vitest';

let review: typeof import('./index');
let games: typeof import('../games/index');
let accounts: typeof import('../accounts/index');
let db: typeof import('../db').db;
let gs: typeof import('../games/schema');
let users: typeof import('../accounts/schema').users;
let analyses: typeof import('./schema').analyses;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  const dbm = await import('../db');
  db = dbm.db;
  await dbm.migrate();
  review = await import('./index');
  games = await import('../games/index');
  accounts = await import('../accounts/index');
  gs = await import('../games/schema');
  ({ users } = await import('../accounts/schema'));
  ({ analyses } = await import('./schema'));
}, 120_000);

// Made-up players; 4 plies.
const PGN = '[White "made_up_rival"]\n[Black "Alpha_Pawn"]\n\n1. e4 c5 2. Nf3 d6 0-1';
const P = 4;
const zeros = () => Array.from({ length: P + 1 }, () => ({ cp: 0 }));
const nulls = () => Array.from({ length: P }, () => null);
const body = (extra: Record<string, unknown> = {}) => ({ depth: 6, evals: zeros(), best: nulls(), ...extra });
const drop = (cp: number) => body({ evals: [{ cp: 0 }, ...Array.from({ length: P }, () => ({ cp }))] });

async function user(passwordHash = 'x') {
  const [u] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash }).returning();
  return u.id;
}
async function game(userId: string, endedAt = new Date(), site = 'chesscom') {
  const [g] = await db
    .insert(gs.games)
    .values({
      userId, site, siteGameId: crypto.randomUUID(), url: 'https://example.test/g', endedAt, timeClass: 'blitz',
      clock: '180+2', colour: 'black', result: 'win', whiteName: 'made_up_rival', blackName: 'Alpha_Pawn', pgn: PGN,
      plies: P,
    })
    .returning();
  return g.id;
}
const count = async (gameId: string) => (await db.select().from(analyses)).filter((a) => a.gameId === gameId).length;

describe('saveAnalysis', () => {
  it('stores zeros as no marks and 100 % accuracy', async () => {
    const u = await user();
    const g = await game(u);
    expect(await review.saveAnalysis(u, g, body())).toEqual({ ok: true, marks: nulls(), accuracyWhite: 100, accuracyBlack: 100 });
    const a = await review.getAnalysis(u, g);
    expect(a).toMatchObject({ depth: 6, marks: nulls(), accuracyWhite: 100, accuracyBlack: 100 });
    expect(a?.phases).toEqual(['opening', 'opening', 'opening', 'opening']);
  });

  it('marks a drop, ignores browser marks and replaces an earlier analysis', async () => {
    const u = await user();
    const g = await game(u);
    const r1 = await review.saveAnalysis(u, g, { ...drop(-300), marks: nulls().map(() => 'blunder') });
    expect(r1.ok && r1.marks).toEqual(['mistake', null, null, null]);
    expect(r1.ok && r1.accuracyBlack).toBe(100);
    const r2 = await review.saveAnalysis(u, g, { ...drop(-1000), depth: 9 });
    expect(r2.ok && r2.marks[0]).toBe('blunder');
    const a = await review.getAnalysis(u, g);
    expect(a?.depth).toBe(9);
    expect(a?.marks[0]).toBe('blunder');
    expect(a?.accuracyWhite).toBe(r2.ok && r2.accuracyWhite);
    expect(await count(g)).toBe(1);
  });

  it('does not mark the best move', async () => {
    const u = await user();
    const g = await game(u);
    const r = await review.saveAnalysis(u, g, { ...drop(-300), best: ['e2e4', null, null, null] });
    expect(r.ok && r.marks[0]).toBeNull();
  });

  it.each([
    [[], 'body'],
    [null, 'body'],
    ['x', 'body'],
    [body({ depth: 0 }), 'depth'],
    [body({ depth: '6' }), 'depth'],
    [body({ depth: 6.5, evals: [] }), 'depth'],
    [body({ evals: zeros().slice(1) }), 'evals'],
    [body({ evals: [...zeros().slice(1), { cp: 0, mate: 1 }] }), 'evals'],
    [body({ evals: [...zeros().slice(1), {}] }), 'evals'],
    [body({ evals: [...zeros().slice(1), { mate: 251 }], best: [] }), 'evals'],
    [body({ best: nulls().slice(1) }), 'best'],
    [body({ best: ['e7e8k', null, null, null] }), 'best'],
  ])('rejects %j with field %s', async (b, field) => {
    const u = await user();
    const g = await game(u);
    expect(await review.saveAnalysis(u, g, b)).toEqual({ ok: false, code: 'invalid_analysis', field });
    expect(await review.getAnalysis(u, g)).toBeNull();
  });

  it('accepts the bounds', async () => {
    const u = await user();
    const g = await game(u);
    const b = body({ depth: 30, evals: [{ cp: -100000 }, { mate: -250 }, { mate: 250 }, { cp: 100000 }, { mate: 0 }] });
    expect((await review.saveAnalysis(u, g, { ...b, best: ['e7e8q', null, null, null] })).ok).toBe(true);
  });

  it("answers not_found for an unknown, malformed or another user's game", async () => {
    const u = await user();
    const v = await user();
    const g = await game(u);
    for (const id of [crypto.randomUUID(), 'abc']) expect(await review.saveAnalysis(u, id, body())).toEqual({ ok: false, code: 'not_found' });
    expect(await review.saveAnalysis(v, g, body())).toEqual({ ok: false, code: 'not_found' });
    expect(await review.getAnalysis(v, g)).toBeNull();
    expect(await review.getAnalysis(u, 'abc')).toBeNull();
  });
});

describe('accuracies', () => {
  it('maps the analysed games of the user only', async () => {
    const u = await user();
    const [g1, g2] = [await game(u), await game(u)];
    await review.saveAnalysis(u, g1, drop(-300));
    const r = await review.saveAnalysis(u, g1, drop(-300));
    const m = await review.accuracies(u, [g1, g2, 'abc']);
    expect([...m.keys()]).toEqual([g1]);
    expect(m.get(g1)).toEqual({ white: r.ok && r.accuracyWhite, black: 100 });
    expect((await review.accuracies(await user(), [g1])).size).toBe(0);
    expect((await review.accuracies(u, [])).size).toBe(0);
  });
});

describe('cascades', () => {
  it('unlinking the site removes its analyses', async () => {
    const u = await user();
    await db.insert(gs.linkedAccounts).values({ userId: u, site: 'chesscom', username: 'alpha_pawn' });
    const g = await game(u);
    await review.saveAnalysis(u, g, body());
    expect(await games.unlinkAccount(u, 'chesscom')).toBe('ok');
    expect(await count(g)).toBe(0);
  });

  it('deleting the user removes the analyses', async () => {
    const { hashPassword } = await import('../accounts/password');
    const u = await user(await hashPassword('secret-password'));
    const g = await game(u);
    await review.saveAnalysis(u, g, body());
    expect(await accounts.deleteAccount(u, 'secret-password')).toBe('ok');
    expect(await count(g)).toBe(0);
  });

  it('the game cap removes the analyses of the dropped games', async () => {
    const u = await user();
    const old = await game(u, new Date('2020-01-01T00:00:00Z'));
    const recent = await game(u, new Date());
    await review.saveAnalysis(u, old, body());
    await review.saveAnalysis(u, recent, body());
    expect(await games.capGames(u, 1)).toBe(1);
    expect(await count(old)).toBe(0);
    expect(await count(recent)).toBe(1);
  });
});
