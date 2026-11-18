// US-87: the openings module (addMove, explore, summary) on the process db (PGlite memory://).
import { describe, expect, it } from 'vitest';
import { cardsOf, countsOf, deleteAccountOf, newUser, openingsModule, outcomeOf } from '../support/repertoire-db';
import { START_FEN, fenAfter, fillWhiteRepertoire } from '../support/repertoire.mjs';

const NOW = new Date('2026-03-10T12:00:00Z');

async function addLine(m: any, userId: string, colour: 'white' | 'black', ucis: string[], now = NOW) {
  const out = [];
  for (let i = 0; i < ucis.length; i++) out.push(await m.addMove(userId, colour, fenAfter(...ucis.slice(0, i)), ucis[i], now));
  return out;
}

describe('summary and the first move', () => {
  it('1.e4 creates a white repertoire: summary white {positions 1, due 1, learned 0}, black null', async () => {
    const m = await openingsModule();
    const u = await newUser();
    const r = await m.addMove(u.id, 'white', START_FEN, 'e2e4', NOW);
    expect(r.status).toBe('created');
    expect(r.move.san).toBe('e4');
    expect(r.move.by).toBe('player');
    const s = await m.summary(u.id, NOW);
    expect(s.white).toEqual({ positions: 1, due: 1, learned: 0 });
    expect(s.black).toBeNull();
  });

  it('the same move again is exists with the same id; positions stays 1', async () => {
    const m = await openingsModule();
    const u = await newUser();
    const a = await m.addMove(u.id, 'white', START_FEN, 'e2e4', NOW);
    const b = await m.addMove(u.id, 'white', START_FEN, 'e2e4', NOW);
    expect(b.status).toBe('exists');
    expect(b.move.id).toBe(a.move.id);
    expect((await m.summary(u.id, NOW)).white.positions).toBe(1);
  });

  it('an opponent move creates no card: due stays 1', async () => {
    const m = await openingsModule();
    const u = await newUser();
    await m.addMove(u.id, 'white', START_FEN, 'e2e4', NOW);
    const r = await m.addMove(u.id, 'white', fenAfter('e2e4'), 'e7e5', NOW);
    expect(r.status).toBe('created');
    expect(r.move.by).toBe('opponent');
    const s = await m.summary(u.id, NOW);
    expect(s.white).toEqual({ positions: 1, due: 1, learned: 0 });
    expect(await cardsOf(u.id)).toHaveLength(1);
  });

  it('a card is due on the UTC day it was added, with ease 2.5, interval 0, reps 0 (day boundary)', async () => {
    const m = await openingsModule();
    const u = await newUser();
    await m.addMove(u.id, 'white', START_FEN, 'e2e4', new Date('2026-03-01T23:59:59Z'));
    expect(await cardsOf(u.id)).toEqual([{ ease: 2.5, interval_days: 0, reps: 0, due_on: '2026-03-01' }]);
    const v = await newUser();
    await m.addMove(v.id, 'white', START_FEN, 'e2e4', new Date('2026-03-02T00:00:00Z'));
    expect((await cardsOf(v.id))[0].due_on).toBe('2026-03-02');
  });

  it('summary counts due cards by the UTC date of now: not due the day before, due the day itself', async () => {
    const m = await openingsModule();
    const u = await newUser();
    await m.addMove(u.id, 'white', START_FEN, 'e2e4', new Date('2026-03-05T10:00:00Z'));
    expect((await m.summary(u.id, new Date('2026-03-04T23:59:59Z'))).white.due).toBe(0);
    expect((await m.summary(u.id, new Date('2026-03-05T00:00:00Z'))).white.due).toBe(1);
  });
});

describe('addMove errors and sides', () => {
  it('in a black repertoire e2e4 is by opponent and c7c5 after it by player', async () => {
    const m = await openingsModule();
    const u = await newUser();
    const [a, b] = await addLine(m, u.id, 'black', ['e2e4', 'c7c5']);
    expect(a.move.by).toBe('opponent');
    expect(b.move.by).toBe('player');
    const s = await m.summary(u.id, NOW);
    expect(s.black.positions).toBe(1);
    expect(s.white).toBeNull();
  });

  it('e2e5 and an invalid FEN are illegal_move; an unreached position is unknown_position', async () => {
    const m = await openingsModule();
    const u = await newUser();
    expect(outcomeOf(await m.addMove(u.id, 'white', START_FEN, 'e2e5', NOW))).toBe('illegal_move');
    expect(outcomeOf(await m.addMove(u.id, 'white', 'not a fen', 'e2e4', NOW))).toBe('illegal_move');
    expect(outcomeOf(await m.addMove(u.id, 'white', fenAfter('d2d4', 'd7d5'), 'c2c4', NOW))).toBe('unknown_position');
  });

  it('a second player move is player_move_exists', async () => {
    const m = await openingsModule();
    const u = await newUser();
    await m.addMove(u.id, 'white', START_FEN, 'e2e4', NOW);
    expect(outcomeOf(await m.addMove(u.id, 'white', START_FEN, 'd2d4', NOW))).toBe('player_move_exists');
  });
});

describe('explore', () => {
  async function transposed() {
    const m = await openingsModule();
    const u = await newUser();
    await addLine(m, u.id, 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4']);
    return { m, u };
  }

  it('the transposed order reaches the position and shows its moves (Bc4 by the player)', async () => {
    const { m, u } = await transposed();
    const e = await m.explore(u.id, 'white', ['g1f3', 'b8c6', 'e2e4', 'e7e5']);
    expect(e.line.map((x: any) => x.uci)).toEqual(['g1f3', 'b8c6', 'e2e4', 'e7e5']);
    expect(e.moves.map((x: any) => x.san)).toContain('Bc4');
    expect(e.moves.find((x: any) => x.san === 'Bc4').by).toBe('player');
  });

  it('after the first move of the transposing order, the moves of the start position are not shown; after e4 e5 Nf3 is', async () => {
    const { m, u } = await transposed();
    const e = await m.explore(u.id, 'white', ['e2e4', 'e7e5']);
    expect(e.moves.map((x: any) => x.san)).toContain('Nf3');
    const start = await m.explore(u.id, 'white', []);
    expect(start.moves.map((x: any) => x.san)).toContain('e4');
  });

  it('the line is cut at the first illegal move; fen is the full FEN after 1.e4 e5', async () => {
    const { m, u } = await transposed();
    const e = await m.explore(u.id, 'white', ['e2e4', 'e7e5', 'e1e5', 'g1f3']);
    expect(e.line.map((x: any) => x.uci)).toEqual(['e2e4', 'e7e5']);
    expect(e.line.map((x: any) => x.san)).toEqual(['e4', 'e5']);
    expect(e.fen).toBe(fenAfter('e2e4', 'e7e5'));
  });

  it('opening after e2e4 c7c5 is B20 Sicilian Defense; for [] it is null', async () => {
    const m = await openingsModule();
    const u = await newUser();
    expect((await m.explore(u.id, 'white', ['e2e4', 'c7c5'])).opening).toEqual({ eco: 'B20', name: 'Sicilian Defense' });
    expect((await m.explore(u.id, 'white', [])).opening).toBeNull();
  });

  it('each move carries id, uci, san, by and the opening name of the line plus that move', async () => {
    const m = await openingsModule();
    const u = await newUser();
    await addLine(m, u.id, 'white', ['e2e4', 'c7c5']);
    const e = await m.explore(u.id, 'white', ['e2e4']);
    const c5 = e.moves.find((x: any) => x.uci === 'c7c5');
    expect(c5.id).toBeTruthy();
    expect(c5.san).toBe('c5');
    expect(c5.by).toBe('opponent');
    expect(c5.opening).toEqual({ eco: 'B20', name: 'Sicilian Defense' });
  });
});

describe('isolation and deletion', () => {
  it("user B sees none of user A's moves in summary or explore", async () => {
    const m = await openingsModule();
    const a = await newUser();
    const b = await newUser();
    await addLine(m, a.id, 'white', ['e2e4', 'e7e5']);
    const s = await m.summary(b.id, NOW);
    expect(s.white).toBeNull();
    expect(s.black).toBeNull();
    expect((await m.explore(b.id, 'white', [])).moves).toEqual([]);
    expect((await m.explore(b.id, 'white', ['e2e4'])).moves).toEqual([]);
  });

  it('deleting the account removes the repertoires, moves and cards', async () => {
    const m = await openingsModule();
    const u = await newUser();
    await addLine(m, u.id, 'white', ['e2e4', 'e7e5', 'g1f3']);
    await addLine(m, u.id, 'black', ['e2e4', 'c7c5']);
    expect(await countsOf(u.id)).toEqual({ repertoires: 2, moves: 5, cards: 3 });
    expect(await deleteAccountOf(u.id, u.password)).toBe('ok');
    expect(await countsOf(u.id)).toEqual({ repertoires: 0, moves: 0, cards: 0 });
  });
});

describe('2,000 player moves', () => {
  it('one more player move is repertoire_full; opponent moves are still accepted', async () => {
    const m = await openingsModule();
    const u = await newUser();
    const { pending, spare } = await fillWhiteRepertoire(async (fen: string, uci: string) => outcomeOf(await m.addMove(u.id, 'white', fen, uci, NOW)), 2000);
    expect((await m.summary(u.id, NOW)).white.positions).toBe(2000);
    expect(outcomeOf(await m.addMove(u.id, 'white', pending.fen, pending.uci, NOW))).toBe('repertoire_full');
    expect(outcomeOf(await m.addMove(u.id, 'white', spare.fen, spare.uci, NOW))).toBe('created');
    expect((await m.summary(u.id, NOW)).white.positions).toBe(2000);
  });
});
