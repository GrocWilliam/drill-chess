import { describe, expect, it } from 'vitest';
import { emptyProgress, nextProgress } from './progress';

describe('nextProgress', () => {
  it('counts a pass', () => {
    expect(nextProgress(emptyProgress(), true)).toEqual({ attempts: 1, passes: 1, streak: 1, mastered: false });
  });
  it('masters at a streak of 3 and keeps it after a failure', () => {
    let p = emptyProgress();
    for (let i = 0; i < 3; i++) p = nextProgress(p, true);
    expect(p.mastered).toBe(true);
    expect(nextProgress(p, false)).toEqual({ attempts: 4, passes: 3, streak: 0, mastered: true });
  });
});
