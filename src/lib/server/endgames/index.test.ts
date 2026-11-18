import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.stubEnv('PGLITE_DATA_DIR', 'memory://');

describe('endgames', () => {
  let m: typeof import('./index');
  let uid: string;
  let other: string;
  beforeAll(async () => {
    const { migrate, db } = await import('../db');
    await migrate();
    const { users } = await import('../accounts/schema');
    const mk = async (email: string) =>
      (await db.insert(users).values({ email, passwordHash: 'x' } as never).returning())[0].id;
    uid = await mk('a@example.com');
    other = await mk('b@example.com');
    m = await import('./index');
  }, 120_000);

  it('records attempts and masters at 3', async () => {
    expect(await m.recordAttempt(uid, 'lucena', true)).toEqual({ attempts: 1, passes: 1, streak: 1, mastered: false });
    await m.recordAttempt(uid, 'lucena', true);
    expect(await m.recordAttempt(uid, 'lucena', true)).toEqual({ attempts: 3, passes: 3, streak: 3, mastered: true });
    expect(await m.recordAttempt(uid, 'lucena', false)).toEqual({ attempts: 4, passes: 3, streak: 0, mastered: true });
    expect(await m.recordAttempt(uid, 'nope', true)).toBeNull();
  });
  it('lists and gets', async () => {
    const l = await m.listEndgames(other);
    expect(l.map((x) => x.positions.length)).toEqual([4, 7, 4, 5]);
    expect(l[2].positions.find((p) => p.id === 'lucena')!.progress.attempts).toBe(0);
    expect(await m.getEndgame(uid, 'philidor')).toMatchObject({ level: 3, goal: 'draw', side: 'black' });
    expect(await m.getEndgame(uid, 'nope')).toBeNull();
  });
});
