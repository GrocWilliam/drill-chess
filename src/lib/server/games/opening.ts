import { and, asc, gt, isNull, eq, sql } from 'drizzle-orm';
import { openingFor, openingMaxPlies } from '../../chess/openings';
import { uciLine } from '../../chess/rules';
import { db } from '../db';
import { games } from './schema';

/** The dataset's name and ECO for a game's PGN, or null (no match, unreadable PGN). */
function lookup(pgn: string) {
  try {
    return openingFor(uciLine(pgn, openingMaxPlies()));
  } catch {
    return null;
  }
}

/** A row to insert: when the site gave no opening name, takes the dataset's (and its ECO when the site gave none). */
export function withOpening<T extends { opening?: string | null; eco?: string | null; pgn: string }>(row: T): T {
  if (row.opening) return row;
  const found = lookup(row.pgn);
  if (!found) return row;
  return { ...row, opening: found.name, eco: row.eco ?? found.eco };
}

const BATCH = 500;

/** Names the stored games that have no opening. Returns how many were updated; games with no match stay null. */
export async function backfillOpenings(): Promise<number> {
  let updated = 0;
  let after: string | null = null;
  for (;;) {
    const rows: { id: string; eco: string | null; pgn: string }[] = await db
      .select({ id: games.id, eco: games.eco, pgn: games.pgn })
      .from(games)
      .where(after ? and(isNull(games.opening), gt(games.id, after)) : isNull(games.opening))
      .orderBy(asc(games.id))
      .limit(BATCH);
    if (!rows.length) break;
    for (const r of rows) {
      const found = lookup(r.pgn);
      if (!found) continue;
      await db
        .update(games)
        .set({ opening: found.name, eco: sql`coalesce(${games.eco}, ${found.eco})` })
        .where(and(eq(games.id, r.id), isNull(games.opening)));
      updated++;
    }
    after = rows[rows.length - 1].id;
  }
  return updated;
}
