// US-90: openings.deletePreview / deleteMove on the process db (PGlite memory://).
import { describe, expect, it } from 'vitest';
import { cardsOf, countsOf, newUser, openingsModule } from '../support/repertoire-db';
import { fenAfter } from '../support/repertoire.mjs';

const NOW = new Date('2026-03-10T12:00:00Z');

async function addLine(m: any, userId: string, colour: 'white' | 'black', ucis: string[]) {
  const ids: string[] = [];
  for (let i = 0; i < ucis.length; i++) {
    const r = await m.addMove(userId, colour, fenAfter(...ucis.slice(0, i)), ucis[i], NOW);
    ids.push(r.move.id);
  }
  return ids;
}
const sans = async (m: any, u: string, line: string[]) => (await m.explore(u, 'white', line)).moves.map((x: any) => x.san).sort();

// 1.e4 e5 2.Nf3 Nc6 3.Bc4 plus 1...c5 2.Nf3
async function main() {
  const m = await openingsModule();
  const u = await newUser();
  const ids = await addLine(m, u.id, 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4']);
  const [, , ] = ids;
  const c5 = await m.addMove(u.id, 'white', fenAfter('e2e4'), 'c7c5', NOW);
  const nf3 = await m.addMove(u.id, 'white', fenAfter('e2e4', 'c7c5'), 'g1f3', NOW);
  return { m, u, ids, c5: c5.move.id, nf3b: nf3.move.id };
}

describe('deleting e5', () => {
  it('deletePreview gives {san: e5, count: 4} and deletes nothing', async () => {
    const { m, u, ids } = await main();
    expect(await m.deletePreview(u.id, 'white', ids[1])).toEqual({ san: 'e5', count: 4 });
    expect((await countsOf(u.id)).moves).toBe(7);
  });

  it('deleteMove answers {removed: 4}; explore after e2e4 lists only c5; summary white positions 2 with 2 cards', async () => {
    const { m, u, ids } = await main();
    expect(await m.deleteMove(u.id, 'white', ids[1])).toEqual({ removed: 4 });
    expect(await sans(m, u.id, ['e2e4'])).toEqual(['c5']);
    expect((await m.summary(u.id, NOW)).white.positions).toBe(2);
    expect(await cardsOf(u.id)).toHaveLength(2);
    expect((await countsOf(u.id)).moves).toBe(3);
  });

  it('deleting it again gives null', async () => {
    const { m, u, ids } = await main();
    await m.deleteMove(u.id, 'white', ids[1]);
    expect(await m.deleteMove(u.id, 'white', ids[1])).toBeNull();
    expect(await m.deletePreview(u.id, 'white', ids[1])).toBeNull();
  });
});

describe('transpositions', () => {
  // P = after 1.e4 e5 2.Nf3 Nc6 = after 1.e4 Nc6 2.Nf3 e5 (one player move per position); from P: Bc4 then Nf6
  async function transposed() {
    const m = await openingsModule();
    const u = await newUser();
    const a = await addLine(m, u.id, 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    const b = await addLine(m, u.id, 'white', ['e2e4', 'b8c6', 'g1f3', 'e7e5']);
    await addLine(m, u.id, 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6']);
    return { m, u, a, b };
  }

  it('deleting the Nc6 of the first order keeps the moves from P and removes only 1', async () => {
    const { m, u, a } = await transposed();
    expect(await m.deletePreview(u.id, 'white', a[3])).toEqual({ san: 'Nc6', count: 1 });
    expect(await m.deleteMove(u.id, 'white', a[3])).toEqual({ removed: 1 });
    expect(await sans(m, u.id, ['e2e4', 'b8c6', 'g1f3', 'e7e5'])).toEqual(['Bc4']);
    expect(await sans(m, u.id, ['e2e4', 'b8c6', 'g1f3', 'e7e5', 'f1c4'])).toEqual(['Nf6']);
  });

  it('then deleting the Nc6 of the other order removes it, Nf3, e5, Bc4 and Nf6: 5', async () => {
    const { m, u, a, b } = await transposed();
    await m.deleteMove(u.id, 'white', a[3]);
    expect(await m.deleteMove(u.id, 'white', b[1])).toEqual({ removed: 5 });
    expect((await countsOf(u.id)).moves).toBe(3); // e4, e5, Nf3
  });
});

describe('deleting e4', () => {
  it('removes every move after it and their cards; summary white positions 0; the repertoire stays', async () => {
    const { m, u, ids } = await main();
    expect(await m.deleteMove(u.id, 'white', ids[0])).toEqual({ removed: 7 });
    expect((await m.summary(u.id, NOW)).white.positions).toBe(0);
    expect(await cardsOf(u.id)).toHaveLength(0);
    const c = await countsOf(u.id);
    expect(c.moves).toBe(0);
    expect(c.repertoires).toBe(1);
  });
});

describe('who can delete', () => {
  it('another user, the wrong colour and a non-UUID give null and delete nothing', async () => {
    const { m, u, ids } = await main();
    const other = await newUser();
    expect(await m.deleteMove(other.id, 'white', ids[1])).toBeNull();
    expect(await m.deletePreview(other.id, 'white', ids[1])).toBeNull();
    expect(await m.deleteMove(u.id, 'black', ids[1])).toBeNull();
    expect(await m.deletePreview(u.id, 'black', ids[1])).toBeNull();
    expect(await m.deleteMove(u.id, 'white', 'abc')).toBeNull();
    expect((await countsOf(u.id)).moves).toBe(7);
  });
});
