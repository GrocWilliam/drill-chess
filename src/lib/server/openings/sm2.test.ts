import { describe, expect, it } from 'vitest';
import { review } from './sm2';

const NEW = { ease: 2.5, intervalDays: 0, reps: 0 };
describe('sm2', () => {
  it('correct x3 gives 1, 6, 16', () => {
    let s = NEW;
    const iv: number[] = [];
    for (let i = 0; i < 3; i++) (s = review(s, true, '2026-11-14')), iv.push(s.intervalDays);
    expect(iv).toEqual([1, 6, 16]);
    expect(s.ease).toBe(2.8);
    expect(review(s, false, '2026-11-14')).toMatchObject({ intervalDays: 1, ease: 2.6, reps: 0 });
  });
  it('ease floor', () => {
    expect(review({ ease: 1.4, intervalDays: 1, reps: 1 }, false, '2026-11-14').ease).toBe(1.3);
    expect(review({ ease: 1.3, intervalDays: 1, reps: 1 }, false, '2026-11-14').ease).toBe(1.3);
  });
  it('due date', () => {
    expect(review(NEW, true, '2026-11-14').dueOn).toBe('2026-11-15');
    expect(review({ ease: 2.7, intervalDays: 6, reps: 2 }, true, '2026-12-20').dueOn).toBe('2027-01-05');
  });
});
