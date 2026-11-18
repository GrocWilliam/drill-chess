// The `endgames` module: bundled positions and the user's progress on them.
import { and, eq, sql } from 'drizzle-orm';
import { validFen } from '../../chess/rules';
import { db } from '../db';
import { GatewayError } from '../gateway/http';
import { probe, type Probe } from '../gateway/tablebase';
import { POSITIONS, type EndgameGoal } from './positions';
import { emptyProgress, MASTERY_STREAK, type Counters } from './progress';
import { endgameProgress, tablebaseCache } from './schema';

export type Progress = Counters;
export interface EndgameEntry {
  id: string;
  goal: EndgameGoal;
  fen: string;
  progress: Progress;
}

const toProgress = (r: { attempts: number; passes: number; streak: number; masteredAt: Date | null }): Progress => ({
  attempts: r.attempts,
  passes: r.passes,
  streak: r.streak,
  mastered: r.masteredAt !== null,
});

async function progressOf(userId: string): Promise<Map<string, Progress>> {
  const rows = await db.select().from(endgameProgress).where(eq(endgameProgress.userId, userId));
  return new Map(rows.map((r) => [r.positionId, toProgress(r)]));
}

/** The four levels with their positions in table order and the user's progress. */
export async function listEndgames(userId: string): Promise<{ level: number; positions: EndgameEntry[] }[]> {
  const progress = await progressOf(userId);
  return [1, 2, 3, 4].map((level) => ({
    level,
    positions: POSITIONS.filter((p) => p.level === level).map((p) => ({
      id: p.id,
      goal: p.goal,
      fen: p.fen,
      progress: progress.get(p.id) ?? emptyProgress(),
    })),
  }));
}

export async function getEndgame(userId: string, id: string) {
  const p = POSITIONS.find((x) => x.id === id);
  if (!p) return null;
  const [row] = await db
    .select()
    .from(endgameProgress)
    .where(and(eq(endgameProgress.userId, userId), eq(endgameProgress.positionId, id)));
  return {
    id: p.id,
    level: p.level,
    goal: p.goal,
    fen: p.fen,
    side: (p.fen.split(' ')[1] === 'b' ? 'black' : 'white') as 'white' | 'black',
    progress: row ? toProgress(row) : emptyProgress(),
  };
}

/** Counts one attempt in a single upsert; null for an unknown id. */
export async function recordAttempt(userId: string, id: string, passed: boolean): Promise<Progress | null> {
  if (!POSITIONS.some((p) => p.id === id)) return null;
  const t = endgameProgress;
  const streak = passed ? sql`${t.streak} + 1` : sql`0`;
  const [row] = await db
    .insert(endgameProgress)
    .values({
      userId,
      positionId: id,
      attempts: 1,
      passes: passed ? 1 : 0,
      streak: passed ? 1 : 0,
      masteredAt: passed && MASTERY_STREAK <= 1 ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [t.userId, t.positionId],
      set: {
        attempts: sql`${t.attempts} + 1`,
        passes: passed ? sql`${t.passes} + 1` : sql`${t.passes}`,
        streak,
        masteredAt: sql`coalesce(${t.masteredAt}, case when ${streak} >= ${MASTERY_STREAK} then now() end)`,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return toProgress(row);
}

export const MAX_TABLEBASE_PIECES = 7;

/** The pieces on the board of `fen`. */
export const pieceCount = (fen: string): number => (fen.trim().split(/\s+/)[0].match(/[pnbrqk]/gi) ?? []).length;

/** A FEN the app may answer for position `startFen`: valid, at most 7 pieces, the app (not the player) to move. */
export function replyableFen(startFen: string, fen: string): boolean {
  if (!validFen(fen) || pieceCount(fen) > MAX_TABLEBASE_PIECES) return false;
  const playerSide = startFen.split(' ')[1];
  return fen.trim().split(/\s+/)[1] !== playerSide;
}

/** The cached tablebase answer for the full FEN (counters included), else probed and cached. Failures are not cached. */
async function cachedProbe(fen: string): Promise<Probe> {
  const [row] = await db.select().from(tablebaseCache).where(eq(tablebaseCache.fen, fen));
  if (row) return row.response as Probe;
  const answer = await probe(fen);
  await db.insert(tablebaseCache).values({ fen, response: answer }).onConflictDoNothing();
  return answer;
}

export type ReplyResult =
  | { category: string; reply: { uci: string; san: string } | null; replyCategory: string | null }
  | { error: 'unknown_position' | 'invalid_fen' | 'tablebase_unavailable' };

/** The tablebase's best reply in `fen` for endgame `id`; `replyCategory` is the player's view after it. */
export async function reply(id: string, fen: string): Promise<ReplyResult> {
  const p = POSITIONS.find((x) => x.id === id);
  if (!p) return { error: 'unknown_position' };
  if (!replyableFen(p.fen, fen)) return { error: 'invalid_fen' };
  let answer: Probe;
  try {
    answer = await cachedProbe(fen);
  } catch (e) {
    if (e instanceof GatewayError) return { error: 'tablebase_unavailable' };
    throw e;
  }
  const best = answer.moves[0];
  return {
    category: answer.category,
    reply: best ? { uci: best.uci, san: best.san } : null,
    replyCategory: best ? best.category : null,
  };
}
