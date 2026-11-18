// The `openings` module: repertoires as a graph of moves keyed by normalised FEN.
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { Chess } from 'chess.js';
import { normaliseFen, turn } from '../../chess/rules';
import { openingFor, type OpeningName } from '../../chess/openings';
import { db } from '../db';
import { reachableAfterDelete } from './tree';
import { cards, repertoireMoves, repertoires } from './schema';
import { review as sm2Review } from './sm2';
import { graphOf, mulberry32, pickLine, pickWeighted, type DrillMove } from './drill';

export type Colour = 'white' | 'black';
export const MAX_PLAYER_MOVES = 2_000;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';

export interface RepertoireMove {
  id: string;
  uci: string;
  san: string;
  by: 'player' | 'opponent';
}

export type AddMoveResult =
  | { status: 'created' | 'exists'; move: RepertoireMove }
  | { error: { code: 'illegal_move' | 'unknown_position' | 'repertoire_full' } }
  | { error: { code: 'player_move_exists'; san: string } };

const today = (now: Date) => now.toISOString().slice(0, 10);
const view = (m: { id: string; uci: string; san: string; by: 'player' | 'opponent' }): RepertoireMove => ({
  id: m.id,
  uci: m.uci,
  san: m.san,
  by: m.by,
});

function tryMove(fen: string, uci: string): { san: string; after: string } | null {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!m) return null;
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from: m[1], to: m[2], promotion: m[3] });
    return { san: move.san, after: chess.fen() };
  } catch {
    return null;
  }
}

class Abort {
  constructor(readonly result: AddMoveResult) {}
}

export async function addMove(
  userId: string,
  colour: Colour,
  fromFen: string,
  uci: string,
  now: Date,
): Promise<AddMoveResult> {
  const found = tryMove(fromFen, uci);
  if (!found) return { error: { code: 'illegal_move' } };
  const played = found;
  const from = normaliseFen(fromFen);
  const to = normaliseFen(played.after);
  const by = turn(fromFen) === (colour === 'white' ? 'w' : 'b') ? 'player' : 'opponent';

  // Errors throw `Abort` so the transaction rolls back and no empty repertoire row survives.
  try {
    return await run();
  } catch (e) {
    if (e instanceof Abort) return e.result;
    throw e;
  }

  function run() {
  return db.transaction(async (tx) => {
    await tx.insert(repertoires).values({ userId, colour }).onConflictDoNothing();
    const [rep] = await tx
      .select({ id: repertoires.id })
      .from(repertoires)
      .where(and(eq(repertoires.userId, userId), eq(repertoires.colour, colour)))
      .for('update');
    const mine = eq(repertoireMoves.repertoireId, rep.id);

    const [same] = await tx
      .select()
      .from(repertoireMoves)
      .where(and(mine, eq(repertoireMoves.fromFen, from), eq(repertoireMoves.uci, uci)));
    if (same) return { status: 'exists' as const, move: view(same) } as AddMoveResult;

    if (from !== START) {
      const [known] = await tx
        .select({ id: repertoireMoves.id })
        .from(repertoireMoves)
        .where(and(mine, eq(repertoireMoves.toFen, from)))
        .limit(1);
      if (!known) throw new Abort({ error: { code: 'unknown_position' } });
    }
    if (by === 'player') {
      const [other] = await tx
        .select({ san: repertoireMoves.san })
        .from(repertoireMoves)
        .where(and(mine, eq(repertoireMoves.fromFen, from), eq(repertoireMoves.by, 'player')));
      if (other) throw new Abort({ error: { code: 'player_move_exists', san: other.san } });
      const [n] = await tx
        .select({ n: count() })
        .from(repertoireMoves)
        .where(and(mine, eq(repertoireMoves.by, 'player')));
      if (n.n >= MAX_PLAYER_MOVES) throw new Abort({ error: { code: 'repertoire_full' } });
    }
    const [move] = await tx
      .insert(repertoireMoves)
      .values({ userId, repertoireId: rep.id, fromFen: from, toFen: to, san: played.san, uci, by })
      .returning();
    if (by === 'player') await tx.insert(cards).values({ userId, repertoireMoveId: move.id, dueOn: today(now) });
    return { status: 'created' as const, move: view(move) } as AddMoveResult;
  });
  }
}

export interface Explored {
  line: { uci: string; san: string }[];
  fen: string;
  opening: OpeningName | null;
  moves: (RepertoireMove & { opening: OpeningName | null })[];
}

export async function explore(userId: string, colour: Colour, line: string[]): Promise<Explored> {
  const chess = new Chess();
  const played: { uci: string; san: string }[] = [];
  for (const uci of line) {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
    if (!m) break;
    try {
      const move = chess.move({ from: m[1], to: m[2], promotion: m[3] });
      played.push({ uci, san: move.san });
    } catch {
      break;
    }
  }
  const ucis = played.map((p) => p.uci);
  const fen = chess.fen();
  const rows = await db
    .select({
      id: repertoireMoves.id,
      uci: repertoireMoves.uci,
      san: repertoireMoves.san,
      by: repertoireMoves.by,
    })
    .from(repertoireMoves)
    .innerJoin(repertoires, eq(repertoires.id, repertoireMoves.repertoireId))
    .where(
      and(
        eq(repertoires.userId, userId),
        eq(repertoires.colour, colour),
        eq(repertoireMoves.fromFen, normaliseFen(fen)),
      ),
    )
    .orderBy(repertoireMoves.createdAt, repertoireMoves.id);
  return {
    line: played,
    fen,
    opening: openingFor(ucis),
    moves: rows.map((r) => ({ ...view(r), opening: openingFor([...ucis, r.uci]) })),
  };
}

export interface Summary {
  positions: number;
  due: number;
  learned: number;
}

export async function summary(userId: string, now: Date): Promise<{ white: Summary | null; black: Summary | null }> {
  const day = today(now);
  const rows = await db
    .select({
      colour: repertoires.colour,
      positions: sql<number>`count(*) filter (where ${repertoireMoves.by} = 'player')::int`,
      due: sql<number>`count(${cards.id}) filter (where ${cards.dueOn} <= ${day})::int`,
      learned: sql<number>`count(${cards.id}) filter (where ${cards.reps} >= 3)::int`,
    })
    .from(repertoires)
    .leftJoin(repertoireMoves, eq(repertoireMoves.repertoireId, repertoires.id))
    .leftJoin(cards, eq(cards.repertoireMoveId, repertoireMoves.id))
    .where(eq(repertoires.userId, userId))
    .groupBy(repertoires.colour);
  const pick = (c: Colour): Summary | null => {
    const r = rows.find((x) => x.colour === c);
    return r ? { positions: r.positions, due: r.due, learned: r.learned } : null;
  };
  return { white: pick('white'), black: pick('black') };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function plan(tx: Pick<typeof db, 'select'>, userId: string, colour: Colour, moveId: string) {
  if (!UUID.test(moveId)) return null;
  const [rep] = await tx
    .select({ id: repertoires.id })
    .from(repertoires)
    .where(and(eq(repertoires.userId, userId), eq(repertoires.colour, colour)));
  if (!rep) return null;
  const rows = await tx
    .select({ id: repertoireMoves.id, fromFen: repertoireMoves.fromFen, toFen: repertoireMoves.toFen, san: repertoireMoves.san })
    .from(repertoireMoves)
    .where(eq(repertoireMoves.repertoireId, rep.id));
  const target = rows.find((r) => r.id === moveId);
  if (!target) return null;
  return { san: target.san, ids: reachableAfterDelete(rows, START, moveId) };
}

/** What deleting the move would remove: its SAN and the number of moves deleted, or null. */
export async function deletePreview(userId: string, colour: Colour, moveId: string): Promise<{ san: string; count: number } | null> {
  const p = await plan(db, userId, colour, moveId);
  return p ? { san: p.san, count: p.ids.length } : null;
}

/** Deletes the move and every move no longer reachable from the start (cards cascade). */
export async function deleteMove(userId: string, colour: Colour, moveId: string): Promise<{ removed: number } | null> {
  return db.transaction(async (tx) => {
    const p = await plan(tx, userId, colour, moveId);
    if (!p) return null;
    await tx.delete(repertoireMoves).where(inArray(repertoireMoves.id, p.ids));
    return { removed: p.ids.length };
  });
}

export interface CardView {
  id: string;
  ease: number;
  intervalDays: number;
  reps: number;
  dueOn: string;
}

/** Applies an SM-2 review to the user's card; null when it does not exist (or is not theirs). */
export async function reviewCard(userId: string, cardId: string, correct: boolean, now: Date): Promise<CardView | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cardId)) return null;
  const [row] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)));
  if (!row) return null;
  const next = sm2Review({ ease: round2(row.ease), intervalDays: row.intervalDays, reps: row.reps }, correct, today(now));
  await db
    .update(cards)
    .set({ ease: next.ease, intervalDays: next.intervalDays, reps: next.reps, dueOn: next.dueOn })
    .where(eq(cards.id, row.id));
  return { id: row.id, ...next };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type DrillLine =
  | {
      colour: Colour;
      moves: { uci: string; san: string; by: 'player' | 'opponent'; cardId: string | null; due: boolean }[];
      opening: OpeningName | null;
    }
  | { moves: []; nextDue: string | null };

/**
 * Picks the next line to drill among the `colours` repertoires (only those with a due card; with several, weighted by
 * 1 + due cards). `seed` makes every pick deterministic. No due card left → `{moves: [], nextDue}`.
 */
export async function nextLine(userId: string, colours: Colour[], now: Date, seed?: number): Promise<DrillLine> {
  const day = today(now);
  const rows = await db
    .select({
      colour: repertoires.colour,
      fromFen: repertoireMoves.fromFen,
      toFen: repertoireMoves.toFen,
      uci: repertoireMoves.uci,
      san: repertoireMoves.san,
      by: repertoireMoves.by,
      cardId: cards.id,
      dueOn: cards.dueOn,
    })
    .from(repertoires)
    .innerJoin(repertoireMoves, eq(repertoireMoves.repertoireId, repertoires.id))
    .leftJoin(cards, eq(cards.repertoireMoveId, repertoireMoves.id))
    .where(and(eq(repertoires.userId, userId), inArray(repertoires.colour, colours)))
    .orderBy(repertoireMoves.createdAt, repertoireMoves.id);

  const byColour = new Map<Colour, { moves: DrillMove[]; due: number }>();
  let nextDue: string | null = null;
  for (const r of rows) {
    const colour = r.colour as Colour;
    let rep = byColour.get(colour);
    if (!rep) byColour.set(colour, (rep = { moves: [], due: 0 }));
    const cardId = r.by === 'player' ? r.cardId : null;
    const due = cardId !== null && r.dueOn !== null && r.dueOn <= day;
    if (due) rep.due++;
    if (cardId && r.dueOn && (nextDue === null || r.dueOn < nextDue)) nextDue = r.dueOn;
    rep.moves.push({ fromFen: r.fromFen, toFen: r.toFen, uci: r.uci, san: r.san, by: r.by, cardId, due });
  }

  const candidates = colours.filter((c) => (byColour.get(c)?.due ?? 0) > 0);
  if (!candidates.length) return { moves: [], nextDue };
  const rand = seed === undefined ? Math.random : mulberry32(seed);
  const colour =
    candidates.length === 1 ? candidates[0] : candidates[pickWeighted(candidates.map((c) => 1 + byColour.get(c)!.due), rand)];
  const line = pickLine(graphOf(byColour.get(colour)!.moves), START, rand);
  return {
    colour,
    moves: line.map(({ uci, san, by, cardId, due }) => ({ uci, san, by, cardId, due })),
    opening: openingFor(line.map((m) => m.uci)),
  };
}
