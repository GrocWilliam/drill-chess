// US-91: openings.reviewCard on the process db (PGlite memory://).
import { describe, expect, it } from 'vitest';
import { cardRowsOf, deleteAccountOf, newUser, openingsModule } from '../support/repertoire-db';
import { START_FEN } from '../support/repertoire.mjs';

const NOW = new Date('2026-11-14T23:30:00Z');

async function userWithCard(m: any) {
  const u = await newUser();
  await m.addMove(u.id, 'white', START_FEN, 'e2e4', NOW);
  const [card] = await cardRowsOf(u.id);
  return { u, card };
}

describe('reviewCard', () => {
  it('a correct review of a new card → {id, ease 2.6, intervalDays 1, reps 1, dueOn 2026-11-15} (UTC date of now)', async () => {
    const m: any = await openingsModule();
    const { u, card } = await userWithCard(m);
    const r = await m.reviewCard(u.id, card.id, true, NOW);
    expect(r).toMatchObject({ id: card.id, ease: 2.6, intervalDays: 1, reps: 1, dueOn: '2026-11-15' });
  });

  it('is stored: the row holds the new state', async () => {
    const m: any = await openingsModule();
    const { u, card } = await userWithCard(m);
    await m.reviewCard(u.id, card.id, true, NOW);
    expect(await cardRowsOf(u.id)).toEqual([{ id: card.id, ease: 2.6, interval_days: 1, reps: 1, due_on: '2026-11-15' }]);
  });

  it('a wrong review → reps 0, intervalDays 1, ease 2.3, due the next day', async () => {
    const m: any = await openingsModule();
    const { u, card } = await userWithCard(m);
    const r = await m.reviewCard(u.id, card.id, false, NOW);
    expect(r).toMatchObject({ ease: 2.3, intervalDays: 1, reps: 0, dueOn: '2026-11-15' });
  });

  it('three correct reviews: intervals 1, 6, 16 and ease 2.8, read back rounded to 2 decimals (real column)', async () => {
    const m: any = await openingsModule();
    const { u, card } = await userWithCard(m);
    const got = [];
    for (let i = 0; i < 3; i++) got.push(await m.reviewCard(u.id, card.id, true, NOW));
    expect(got.map((c: any) => c.intervalDays)).toEqual([1, 6, 16]);
    expect(got[2].ease).toBe(2.8);
    expect(got[2].reps).toBe(3);
    expect(got[2].dueOn).toBe('2026-11-30');
  });

  it('null for an unknown id, a non-UUID, and another user’s card (which stays unchanged)', async () => {
    const m: any = await openingsModule();
    const { u, card } = await userWithCard(m);
    const other = await newUser();
    expect(await m.reviewCard(u.id, crypto.randomUUID(), true, NOW)).toBeNull();
    expect(await m.reviewCard(u.id, 'abc', true, NOW)).toBeNull();
    expect(await m.reviewCard(other.id, card.id, true, NOW)).toBeNull();
    expect((await cardRowsOf(u.id))[0]).toMatchObject({ ease: 2.5, interval_days: 0, reps: 0 });
  });

  it('the summary reflects the reviews: due drops to 0 after a review, learned is 1 after 3 correct ones', async () => {
    const m: any = await openingsModule();
    const { u, card } = await userWithCard(m);
    expect((await m.summary(u.id, NOW)).white).toMatchObject({ due: 1, learned: 0 });
    await m.reviewCard(u.id, card.id, true, NOW);
    expect((await m.summary(u.id, NOW)).white).toMatchObject({ due: 0, learned: 0 });
    await m.reviewCard(u.id, card.id, true, NOW);
    await m.reviewCard(u.id, card.id, true, NOW);
    expect((await m.summary(u.id, NOW)).white).toMatchObject({ due: 0, learned: 1 });
    expect((await m.summary(u.id, new Date('2026-12-31T00:00:00Z'))).white).toMatchObject({ due: 1, learned: 1 });
  });

  it('a review only updates the card: the repertoire keeps its moves, and a card is deleted only with the account', async () => {
    const m: any = await openingsModule();
    const { u, card } = await userWithCard(m);
    await m.reviewCard(u.id, card.id, false, NOW);
    expect((await m.summary(u.id, NOW)).white).toMatchObject({ positions: 1 });
    expect(await cardRowsOf(u.id)).toHaveLength(1);
    await deleteAccountOf(u.id, u.password);
    expect(await cardRowsOf(u.id)).toHaveLength(0);
  });
});
