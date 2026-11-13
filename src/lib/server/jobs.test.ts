import { describe, expect, it, vi } from 'vitest';
import type { ImportJob } from './games';

vi.mock('./games', () => {
  const listeners = new Set<() => void>();
  return {
    resetRunningJobs: vi.fn(async () => 0),
    claimNextJob: vi.fn(async () => null),
    runImportJob: vi.fn(),
    failJob: vi.fn(async () => {}),
    onJobQueued: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
  };
});

const { startJobLoop } = await import('./jobs');
const games = await import('./games');

const job = (id: string): ImportJob => ({ id, userId: 'u', site: 'chesscom', status: 'running', imported: 0, skipped: 0, error: null });

describe('startJobLoop', () => {
  it('resets running jobs, runs queued jobs one at a time and survives a throwing job', async () => {
    const queue = [job('a'), job('b'), job('c')];
    const ran: string[] = [];
    let active = 0;
    const fail = vi.fn(async () => {});
    const loop = startJobLoop({
      pollMs: 10,
      claim: async () => queue.shift() ?? null,
      run: async (j) => {
        expect(++active).toBe(1);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        ran.push(j.id);
        if (j.id === 'b') throw new Error('row deleted');
      },
      fail,
      log: () => {},
    });
    await vi.waitFor(() => expect(ran).toEqual(['a', 'b', 'c']));
    await loop.stop();
    expect(games.resetRunningJobs).toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith('b');
  });

  it('wakes before the poll interval when woken', async () => {
    const queue: ImportJob[] = [];
    const ran: string[] = [];
    const loop = startJobLoop({ pollMs: 60_000, claim: async () => queue.shift() ?? null, run: async (j) => void ran.push(j.id) });
    await new Promise((r) => setTimeout(r, 20));
    queue.push(job('x'));
    loop.wake();
    await vi.waitFor(() => expect(ran).toEqual(['x']), { timeout: 1000 });
    await loop.stop();
  });
});
