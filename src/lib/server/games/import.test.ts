import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChesscomGame } from '../gateway/chesscom';
import { STANDARD_START } from './map-chesscom';

const listArchives = vi.fn();
const fetchArchive = vi.fn();
vi.mock('../gateway/chesscom', () => ({
  playerExists: async () => true,
  listArchives: (u: string) => listArchives(u),
  fetchArchive: (p: string) => fetchArchive(p),
}));
vi.mock('../gateway/lichess', () => ({ userExists: async () => true }));

type Games = typeof import('./index');
let g: Games;
let db: typeof import('../db').db;
let schema: typeof import('./schema');
let users: typeof import('../accounts/schema').users;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  ({ db } = await import('../db'));
  await (await import('../db')).migrate();
  g = await import('./index');
  schema = await import('./schema');
  ({ users } = await import('../accounts/schema'));
}, 120_000);

const NOW = new Date('2026-02-10T12:00:00Z');
const game = (id: string, over: Partial<ChesscomGame> = {}): ChesscomGame => ({
  url: `https://www.chess.com/game/live/${id}`,
  pgn: '[ECO "C20"]\n\n1. e4 e5 2. Nf3 1-0\n',
  time_control: '180',
  end_time: 1_770_000_000,
  time_class: 'blitz',
  rules: 'chess',
  initial_setup: STANDARD_START,
  white: { username: 'made_up_me', rating: 1500, result: 'win' },
  black: { username: 'made_up_rival', rating: 1500, result: 'resigned' },
  ...over,
});
const archive = (year: number, month: number) => ({
  year,
  month,
  path: `/pub/player/made_up_me/games/${year}/${String(month).padStart(2, '0')}`,
});

const newUser = async () =>
  (await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash: 'x' }).returning())[0].id;

/** Links chess.com for a new user, claims its job (the only one queued) and runs it. */
async function importFor(userId: string) {
  expect(await g.linkAccount(userId, 'chesscom', 'Made_Up_Me')).toBe('ok');
  const job = await g.claimNextJob();
  expect(job).toMatchObject({ userId, site: 'chesscom', status: 'running' });
  await g.runImportJob(job!, NOW);
  return job!;
}

beforeEach(async () => {
  // Earlier tests' leftovers must not be claimed.
  await db.delete(schema.importJobs);
  listArchives.mockReset().mockResolvedValue([archive(2025, 11), archive(2025, 12), archive(2026, 1), archive(2026, 2)]);
  fetchArchive.mockReset().mockImplementation(async (path: string) => {
    if (path.endsWith('2026/02'))
      return [game('1'), game('2', { rules: 'chess960' }), game('3', { initial_setup: '8/8/8/8/8/8/8/K6k w - - 0 1' })];
    if (path.endsWith('2026/01')) return [game('4', { pgn: '1. e4 e5 2. Ke3' }), null];
    if (path.endsWith('2025/12')) return [game('5', { black: { username: 'MADE_UP_ME', rating: 1, result: 'agreed' }, white: { username: 'x', rating: 1, result: 'agreed' } }), game('6', { white: { username: 'someone', rating: 1, result: 'win' } })];
    return [game('7')];
  });
});

describe('lastMonths', () => {
  it('is the current UTC month and the previous ones, oldest first, across a year', () => {
    expect(g.lastMonths(3, NOW)).toEqual([
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
  });
});

describe('runImportJob (chess.com first import)', () => {
  it('imports the 3 months oldest first, counts skips, ends done and sets last_synced_at', async () => {
    const id = await newUser();
    const job = await importFor(id);
    expect(fetchArchive.mock.calls.map((c) => c[0])).toEqual([
      '/pub/player/made_up_me/games/2025/12',
      '/pub/player/made_up_me/games/2026/01',
      '/pub/player/made_up_me/games/2026/02',
    ]);
    expect(await g.importStatus(id)).toEqual([{ site: 'chesscom', status: 'done', imported: 2, skipped: 5, error: null, finishedAt: expect.anything() }]);
    const rows = await db.query.games.findMany({ where: (t, { eq }) => eq(t.userId, id), orderBy: (t, { asc }) => asc(t.siteGameId) });
    expect(rows.map((r) => [r.siteGameId, r.colour, r.result, r.plies])).toEqual([
      ['1', 'white', 'win', 3],
      ['5', 'black', 'draw', 3],
    ]);
    expect((await g.listLinkedAccounts(id))[0].lastSyncedAt).toBeInstanceOf(Date);
    expect(job.status).toBe('running');
  });

  it('counts only inserted rows: games are unique per user, not across users', async () => {
    const a = await newUser();
    await importFor(a);
    const b = await newUser();
    await importFor(b);
    expect((await g.importStatus(b))[0].imported).toBe(2);
    // A second run for the same user inserts nothing new.
    await db.insert(schema.importJobs).values({ userId: b, site: 'chesscom' });
    await g.runImportJob((await g.claimNextJob())!, NOW);
    expect((await g.importStatus(b))[0]).toMatchObject({ status: 'done', imported: 0 });
  });

  it('ends failed with site_unavailable and keeps the games of earlier archives', async () => {
    const { GatewayError } = await import('../gateway/http');
    fetchArchive.mockImplementation(async (path: string) => {
      if (path.endsWith('2025/12')) return [game('8')];
      throw new GatewayError('unavailable');
    });
    const id = await newUser();
    await importFor(id);
    expect(await g.importStatus(id)).toEqual([
      { site: 'chesscom', status: 'failed', imported: 1, skipped: 0, error: 'site_unavailable', finishedAt: expect.anything() },
    ]);
    expect((await g.listLinkedAccounts(id))[0].lastSyncedAt).toBeNull();
  });

  it('throws on a deleted user, and failJob is then a no-op', async () => {
    const id = await newUser();
    expect(await g.linkAccount(id, 'chesscom', 'made_up_me')).toBe('ok');
    const job = (await g.claimNextJob())!;
    await db.delete(users).where((await import('drizzle-orm')).eq(users.id, id));
    // The linked account is gone with the user: nothing to import, nothing to update.
    await expect(g.runImportJob(job, NOW)).resolves.toBeUndefined();
    await g.failJob(job.id);
    expect(await g.importStatus(id)).toEqual([]);
  });
});

describe('job queue', () => {
  it('claims the oldest queued job, resets running ones, and importStatus shows the latest per site', async () => {
    const a = await newUser();
    const b = await newUser();
    await db.insert(schema.importJobs).values({ userId: a, site: 'chesscom', createdAt: new Date('2026-01-01') });
    await db.insert(schema.importJobs).values({ userId: b, site: 'lichess', createdAt: new Date('2026-01-02') });
    const first = await g.claimNextJob();
    expect(first).toMatchObject({ userId: a, status: 'running' });
    expect(await g.resetRunningJobs()).toBe(1);
    expect((await g.claimNextJob())?.userId).toBe(a);
    expect((await g.claimNextJob())?.userId).toBe(b);
    expect(await g.claimNextJob()).toBeNull();
    await g.runImportJob(first!, NOW);
    await db.insert(schema.importJobs).values({ userId: a, site: 'chesscom' });
    expect(await g.importStatus(a)).toEqual([{ site: 'chesscom', status: 'queued', imported: 0, skipped: 0, error: null, finishedAt: null }]);
  });

  it('tells listeners when a link queues a job', async () => {
    const heard = vi.fn();
    const off = g.onJobQueued(heard);
    await g.linkAccount(await newUser(), 'lichess', 'made_up_me');
    off();
    expect(heard).toHaveBeenCalledOnce();
  });
});

describe('the 5,000-games cap', () => {
  const row = (userId: string, i: number) => ({
    userId,
    site: 'lichess' as const,
    siteGameId: `old${i}`,
    url: `https://lichess.org/old${i}`,
    endedAt: new Date(Date.UTC(2020, 0, 1) + i * 60_000),
    timeClass: 'blitz',
    clock: '180+0',
    colour: 'white',
    result: 'win',
    whiteName: 'made_up_me',
    blackName: 'made_up_rival',
    pgn: '1. e4 e5',
    plies: 2,
  });

  it('capGames deletes only the oldest games beyond the limit, and only the user\'s', async () => {
    const a = await newUser();
    const b = await newUser();
    await db.insert(schema.games).values([...Array(7)].map((_, i) => row(a, i)));
    await db.insert(schema.games).values([...Array(3)].map((_, i) => row(b, i)));
    expect(await g.capGames(a, 5)).toBe(2);
    const left = (await g.listGames(a)).games.map((x) => x.siteGameId);
    expect(left).toEqual(['old6', 'old5', 'old4', 'old3', 'old2']);
    expect((await g.listGames(b)).games).toHaveLength(3);
    expect(await g.capGames(a, 5)).toBe(0);
  });

  it('runs after a job, even a failed one: 5,001 stored + 1 imported → the 5,000 newest, 100 pages', async () => {
    const { GatewayError } = await import('../gateway/http');
    const id = await newUser();
    for (let i = 0; i < 5_001; i += 1_000)
      await db.insert(schema.games).values([...Array(Math.min(1_000, 5_001 - i))].map((_, k) => row(id, i + k)));
    fetchArchive.mockImplementation(async (path: string) => {
      if (path.endsWith('2025/12')) return [game('cap1')];
      throw new GatewayError('unavailable');
    });
    await importFor(id);
    expect((await g.importStatus(id))[0]).toMatchObject({ status: 'failed', imported: 1 });
    const page100 = await g.listGames(id, {}, 100);
    expect(page100.games).toHaveLength(50);
    expect(page100.hasNext).toBe(false);
    // The 2 oldest are gone; the newest (the imported game) is first.
    expect(page100.games.at(-1)!.siteGameId).toBe('old2');
    expect((await g.listGames(id, {}, 1)).games[0].site).toBe('chesscom');
  }, 60_000);
});
