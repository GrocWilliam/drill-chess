import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, type Connection } from './index';
import { games, importJobs, linkedAccounts, loginFailures, passwordResets, sessions, users } from './schema';

describe('migrations on PGlite', () => {
  let conn: Connection;
  beforeAll(async () => {
    conn = connect({ pgliteDataDir: 'memory://' });
    await conn.migrate();
  });
  afterAll(() => conn.close());

  const newUser = async (email: string) =>
    (await conn.db.insert(users).values({ email, passwordHash: 'x' }).returning())[0];

  it('creates users with defaults and a unique lower(email)', async () => {
    const u = await newUser('Alice@Example.test');
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(u.lang).toBe('en');
    expect(u.theme).toBe('system');
    await expect(newUser('alice@example.TEST')).rejects.toThrow();
  });

  it('checks lang and theme', async () => {
    await expect(conn.db.insert(users).values({ email: 'l@x.test', passwordHash: 'x', lang: 'de' })).rejects.toThrow();
    await expect(conn.db.insert(users).values({ email: 't@x.test', passwordHash: 'x', theme: 'blue' })).rejects.toThrow();
  });

  it('allows one queued or running import job per user', async () => {
    const u = await newUser('jobs@x.test');
    await conn.db.insert(importJobs).values({ userId: u.id, site: 'lichess' });
    await expect(conn.db.insert(importJobs).values({ userId: u.id, site: 'chesscom', status: 'running' })).rejects.toThrow();
    await conn.db.insert(importJobs).values({ userId: u.id, site: 'chesscom', status: 'done' });
    await expect(conn.db.insert(importJobs).values({ userId: u.id, site: 'chesscom', status: 'paused' })).rejects.toThrow();
  });

  it('keeps one linked account per site and one game per site id', async () => {
    const u = await newUser('link@x.test');
    await conn.db.insert(linkedAccounts).values({ userId: u.id, site: 'lichess', username: 'a' });
    await expect(conn.db.insert(linkedAccounts).values({ userId: u.id, site: 'lichess', username: 'b' })).rejects.toThrow();
    const game = {
      userId: u.id, site: 'lichess', siteGameId: 'g1', url: 'https://lichess.org/g1', endedAt: new Date(),
      timeClass: 'blitz', clock: '180+2', colour: 'white', result: 'win', whiteName: 'a', blackName: 'b', pgn: '', plies: 0,
    };
    await conn.db.insert(games).values(game);
    await expect(conn.db.insert(games).values(game)).rejects.toThrow();
  });

  it('deletes everything a user owns with the user', async () => {
    const u = await newUser('gone@x.test');
    const later = new Date(Date.now() + 86400000);
    await conn.db.insert(sessions).values({ id: 'a'.repeat(64), userId: u.id, expiresAt: later });
    await conn.db.insert(passwordResets).values({ tokenHash: 'b'.repeat(64), userId: u.id, expiresAt: later });
    await conn.db.insert(linkedAccounts).values({ userId: u.id, site: 'chesscom', username: 'c' });
    await conn.db.insert(importJobs).values({ userId: u.id, site: 'chesscom' });
    await conn.db.insert(loginFailures).values({ emailLower: 'gone@x.test' });
    await conn.db.execute(sql`delete from users where id = ${u.id}`);
    for (const t of [sessions, passwordResets, linkedAccounts, importJobs]) {
      const rows = await conn.db.select().from(t).where(sql`user_id = ${u.id}`);
      expect(rows).toHaveLength(0);
    }
  });
});

describe('migrations on a PGlite directory', () => {
  it('run once and are skipped on the next open', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'drill-chess-db-test-'));
    try {
      for (let i = 0; i < 2; i++) {
        const conn = connect({ pgliteDataDir: dir });
        await conn.migrate();
        await conn.db.insert(users).values({ email: `u${i}@x.test`, passwordHash: 'x' });
        expect(await conn.db.select().from(users)).toHaveLength(i + 1);
        await conn.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
