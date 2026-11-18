// US-108: the endgames module (listEndgames, getEndgame, recordAttempt) on the process db (PGlite memory://).
import { describe, expect, it } from 'vitest';
import { deleteAccountOf, endgamesModule, listedProgress, newUser, progressRowCount } from '../support/endgames-db';

const ZERO = { attempts: 0, passes: 0, streak: 0, mastered: false };

describe('listEndgames', () => {
  it('returns 4 levels with 4, 7, 4 and 5 positions in table order, carrying the progress', async () => {
    const m = await endgamesModule();
    const u = await newUser();
    await m.recordAttempt(u.id, 'kq-k', true);
    await m.recordAttempt(u.id, 'kq-k', true);
    const levels = await m.listEndgames(u.id);
    expect(levels.map((l: any) => l.level)).toEqual([1, 2, 3, 4]);
    expect(levels.map((l: any) => l.positions.length)).toEqual([4, 7, 4, 5]);
    expect(levels[0].positions.map((p: any) => p.id)).toEqual(['kq-k', 'kr-k', 'krr-k', 'kbb-k']);
    expect(levels[2].positions.map((p: any) => p.id)).toEqual(['lucena', 'philidor', 'philidor-early', 'vancura']);
    const kqk = levels[0].positions[0];
    expect(kqk.goal).toBe('win');
    expect(kqk.fen).toBe('8/8/8/4k3/8/8/8/3QK3 w - - 0 1');
    expect(kqk.progress).toEqual({ attempts: 2, passes: 2, streak: 2, mastered: false });
    expect(levels[0].positions[1].progress).toEqual(ZERO);
  });

  it('shows kq-k with attempts 0 to another user', async () => {
    const m = await endgamesModule();
    const a = await newUser();
    const b = await newUser();
    await m.recordAttempt(a.id, 'kq-k', true);
    expect((await listedProgress(m, b.id, 'kq-k')).attempts).toBe(0);
    expect(await listedProgress(m, b.id, 'kq-k')).toEqual(ZERO);
  });
});

describe('getEndgame', () => {
  it('philidor is level 3, goal draw, side black', async () => {
    const m = await endgamesModule();
    const u = await newUser();
    await m.recordAttempt(u.id, 'kq-k', true);
    const g = await m.getEndgame(u.id, 'philidor');
    expect(g.id).toBe('philidor');
    expect(g.level).toBe(3);
    expect(g.goal).toBe('draw');
    expect(g.side).toBe('black');
    expect(g.fen).toBe('4k3/8/7r/3KP3/8/8/8/R7 b - - 0 1');
    expect(g.progress).toEqual(ZERO);
  });

  it('kq-k is side white', async () => {
    const m = await endgamesModule();
    const u = await newUser();
    expect((await m.getEndgame(u.id, 'kq-k')).side).toBe('white');
  });

  it('an unknown id is null', async () => {
    const m = await endgamesModule();
    const u = await newUser();
    await m.recordAttempt(u.id, 'kq-k', true);
    expect(await m.getEndgame(u.id, 'nope')).toBeNull();
  });
});

describe('recordAttempt', () => {
  it('an unknown id is null and stores nothing', async () => {
    const m = await endgamesModule();
    const u = await newUser();
    expect(await m.recordAttempt(u.id, 'nope', true)).toBeNull();
    expect(await progressRowCount(u.id)).toBe(0);
  });

  it('a pass then a fail: streak 1 then 0, attempts 2, passes 1', async () => {
    const m = await endgamesModule();
    const u = await newUser();
    expect(await m.recordAttempt(u.id, 'kq-k', true)).toEqual({ attempts: 1, passes: 1, streak: 1, mastered: false });
    expect(await m.recordAttempt(u.id, 'kq-k', false)).toEqual({ attempts: 2, passes: 1, streak: 0, mastered: false });
  });

  it('three passes master lucena; a fail keeps it mastered with streak 0; a pass gives streak 1, still mastered', async () => {
    const m = await endgamesModule();
    const u = await newUser();
    await m.recordAttempt(u.id, 'lucena', true);
    await m.recordAttempt(u.id, 'lucena', true);
    expect(await m.recordAttempt(u.id, 'lucena', true)).toEqual({ attempts: 3, passes: 3, streak: 3, mastered: true });
    expect(await m.recordAttempt(u.id, 'lucena', false)).toEqual({ attempts: 4, passes: 3, streak: 0, mastered: true });
    expect(await m.recordAttempt(u.id, 'lucena', true)).toEqual({ attempts: 5, passes: 4, streak: 1, mastered: true });
    expect(await listedProgress(m, u.id, 'lucena')).toEqual({ attempts: 5, passes: 4, streak: 1, mastered: true });
  });
});

describe('account deletion and no deletion of progress', () => {
  it('no endgame_progress row is deleted by later attempts', async () => {
    const m = await endgamesModule();
    const u = await newUser();
    await m.recordAttempt(u.id, 'kq-k', true);
    await m.recordAttempt(u.id, 'lucena', false);
    expect(await progressRowCount(u.id)).toBe(2);
    await m.recordAttempt(u.id, 'kq-k', false);
    await m.recordAttempt(u.id, 'lucena', true);
    await m.listEndgames(u.id);
    await m.getEndgame(u.id, 'kq-k');
    expect(await progressRowCount(u.id)).toBe(2);
  });

  it('deleting the account leaves no endgame_progress row for the user, and keeps another user\'s', async () => {
    const m = await endgamesModule();
    const u = await newUser();
    const other = await newUser();
    await m.recordAttempt(u.id, 'kq-k', true);
    await m.recordAttempt(u.id, 'lucena', true);
    await m.recordAttempt(other.id, 'kq-k', true);
    expect(await progressRowCount(u.id)).toBe(2);
    expect(await deleteAccountOf(u.id, u.password)).toBe('ok');
    expect(await progressRowCount(u.id)).toBe(0);
    expect(await progressRowCount(other.id)).toBe(1);
  });
});
