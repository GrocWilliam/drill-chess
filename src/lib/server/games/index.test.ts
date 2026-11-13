import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const exists = vi.fn();
vi.mock('../gateway/chesscom', () => ({ playerExists: (u: string) => exists('chesscom', u) }));
vi.mock('../gateway/lichess', () => ({ userExists: (u: string) => exists('lichess', u) }));

let linkAccount: typeof import('./index').linkAccount;
let listLinkedAccounts: typeof import('./index').listLinkedAccounts;
let db: typeof import('../db').db;
let users: typeof import('../accounts/schema').users;
let importJobs: typeof import('./schema').importJobs;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  ({ db } = await import('../db'));
  await (await import('../db')).migrate();
  ({ linkAccount, listLinkedAccounts } = await import('./index'));
  ({ users } = await import('../accounts/schema'));
  ({ importJobs } = await import('./schema'));
}, 120_000); // PGlite start-up is slow on loaded machines
beforeEach(() => exists.mockReset().mockResolvedValue(true));

const newUser = async () =>
  (await db.insert(users).values({ email: `${crypto.randomUUID()}@example.test`, passwordHash: 'x' }).returning())[0].id;

describe('linkAccount', () => {
  it('checks the format before anything else', async () => {
    const id = await newUser();
    for (const bad of ['', 'bad name!', 'a'.repeat(51)]) expect(await linkAccount(id, 'lichess', bad)).toBe('username_invalid');
    expect(exists).not.toHaveBeenCalled();
  });

  it('links and queues a job', async () => {
    const id = await newUser();
    expect(await linkAccount(id, 'chesscom', 'Alpha_Pawn')).toBe('ok');
    expect(await listLinkedAccounts(id)).toMatchObject([{ site: 'chesscom', username: 'Alpha_Pawn' }]);
    const jobs = await db.select().from(importJobs);
    expect(jobs.filter((j) => j.userId === id)).toMatchObject([{ status: 'queued', site: 'chesscom' }]);
  });

  it('refuses while a job is active, before asking the site', async () => {
    const id = await newUser();
    await linkAccount(id, 'chesscom', 'a');
    exists.mockClear();
    expect(await linkAccount(id, 'lichess', 'b')).toBe('import_running');
    expect(exists).not.toHaveBeenCalled();
  });

  it('maps unknown and unavailable', async () => {
    const id = await newUser();
    exists.mockResolvedValueOnce(false);
    expect(await linkAccount(id, 'lichess', 'x')).toBe('username_unknown');
    const { GatewayError } = await import('../gateway/http');
    exists.mockRejectedValueOnce(new GatewayError('unavailable'));
    expect(await linkAccount(id, 'lichess', 'x')).toBe('site_unavailable');
    expect(await listLinkedAccounts(id)).toEqual([]);
  });
});
