import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../gateway/chesscom', () => ({ playerExists: async () => true, listArchives: async () => [], fetchArchive: async () => [] }));
vi.mock('../gateway/lichess', () => ({ userExists: async () => true }));

let g: typeof import('./index');
let userId: string;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  const { db, migrate } = await import('../db');
  await migrate();
  g = await import('./index');
  const { users } = await import('../accounts/schema');
  const [u] = await db.insert(users).values({ email: 'sync@example.test', passwordHash: 'x' } as never).returning({ id: users.id });
  userId = u.id;
}, 120_000);

describe('requestSync', () => {
  it('refuses a site that is not linked', async () => {
    expect(await g.requestSync(userId, 'lichess')).toBe('not_linked');
  });
  it('queues a job, then refuses a second while it is active', async () => {
    expect(await g.linkAccount(userId, 'chesscom', 'made_up_me')).toBe('ok');
    expect(await g.requestSync(userId, 'chesscom')).toBe('import_running');
    const job = await g.claimNextJob();
    await g.runImportJob(job!);
    expect(await g.requestSync(userId, 'chesscom')).toBe('ok');
  });
});
