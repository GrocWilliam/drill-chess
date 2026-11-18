// US-91: the pure SM-2 scheduler src/lib/server/openings/sm2.ts.
import { describe, expect, it } from 'vitest';

type State = { ease: number; intervalDays: number; reps: number };
const NEW: State = { ease: 2.5, intervalDays: 0, reps: 0 };
const sm2 = () => import('../../../src/lib/server/openings/sm2');

describe('correct answers', () => {
  it('three correct reviews of a new card: intervals 1, 6, 16, reps 3, ease 2.8', async () => {
    const { review } = await sm2();
    let s: State = NEW;
    const intervals: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = review(s, true, '2026-11-14');
      intervals.push(r.intervalDays);
      s = r;
    }
    expect(intervals).toEqual([1, 6, 16]);
    expect(s.reps).toBe(3);
    expect(s.ease).toBe(2.8);
  });
});

describe('wrong answers', () => {
  it('a wrong review of the card (ease 2.8, interval 16, reps 3): interval 1, ease 2.6, reps 0', async () => {
    const { review } = await sm2();
    const r = review({ ease: 2.8, intervalDays: 16, reps: 3 }, false, '2026-11-14');
    expect(r.intervalDays).toBe(1);
    expect(r.ease).toBe(2.6);
    expect(r.reps).toBe(0);
  });

  it('ease 1.4 wrong → 1.3; ease 1.3 wrong again → 1.3', async () => {
    const { review } = await sm2();
    const a = review({ ease: 1.4, intervalDays: 6, reps: 2 }, false, '2026-11-14');
    expect(a.ease).toBe(1.3);
    const b = review({ ease: 1.3, intervalDays: 6, reps: 2 }, false, '2026-11-14');
    expect(b.ease).toBe(1.3);
  });
});

describe('dueOn', () => {
  it('a correct review of a new card on 2026-11-14 is due 2026-11-15', async () => {
    const { review } = await sm2();
    expect(review(NEW, true, '2026-11-14').dueOn).toBe('2026-11-15');
  });

  it('interval 16 from 2026-12-20 is due 2027-01-05', async () => {
    const { review } = await sm2();
    // reps 2 → the new reps is 3, interval round(6 × 2.7) = 16.
    const r = review({ ease: 2.7, intervalDays: 6, reps: 2 }, true, '2026-12-20');
    expect(r.intervalDays).toBe(16);
    expect(r.dueOn).toBe('2027-01-05');
  });

  it('a wrong review is due the next day', async () => {
    const { review } = await sm2();
    expect(review({ ease: 2.8, intervalDays: 16, reps: 3 }, false, '2026-12-31').dueOn).toBe('2027-01-01');
  });
});

describe('the ease before this review sets the interval, then it rises by 0.1 (rounded to 2 decimals)', () => {
  it('reps 3 with ease 2.5 and interval 10 → interval 25, ease 2.6', async () => {
    const { review } = await sm2();
    const r = review({ ease: 2.5, intervalDays: 10, reps: 3 }, true, '2026-11-14');
    expect(r.intervalDays).toBe(25);
    expect(r.ease).toBe(2.6);
    expect(r.reps).toBe(4);
  });

  it('no float drift: ten correct reviews from 2.5 end at exactly 3.5, ten wrong ones from 2.5 at exactly 1.3', async () => {
    const { review } = await sm2();
    let s: State = NEW;
    for (let i = 0; i < 10; i++) s = review(s, true, '2026-11-14');
    expect(s.ease).toBe(3.5);
    s = NEW;
    for (let i = 0; i < 10; i++) s = review(s, false, '2026-11-14');
    expect(s.ease).toBe(1.3);
  });
});
